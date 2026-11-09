import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { issueRefreshToken, revokeAllForUser, sha256, signAccessToken } from './token.service.js';
import { provisionNewUser } from './userSetup.service.js';

const SALT_ROUNDS = 12;

async function sessionFor(user: { _id: unknown; role: string }, ctx: { userAgent?: string; ip?: string }) {
  const id = String(user._id);
  const accessToken = signAccessToken({ sub: id, role: user.role as 'user' | 'admin' });
  const refresh = await issueRefreshToken(id, undefined, ctx);
  return { accessToken, refresh };
}

export async function register(input: { name: string; email: string; password: string }, ctx = {}) {
  const userCount = await UserModel.estimatedDocumentCount();
  // First user can always register (becomes admin). After that, respect the flag.
  if (userCount > 0 && !env.ALLOW_REGISTRATION) throw ApiError.forbidden('Registration is disabled');

  const exists = await UserModel.exists({ email: input.email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
    role: userCount === 0 ? 'admin' : 'user',
  });
  await provisionNewUser(user._id);
  return { user, ...(await sessionFor(user, ctx)) };
}

export async function login(input: { email: string; password: string }, ctx = {}) {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  // Same message for unknown email and wrong password — no account enumeration.
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  return { user, ...(await sessionFor(user, ctx)) };
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  if (!(await bcrypt.compare(current, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(next, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllForUser(userId); // log out all other sessions
}

/**
 * Generates a reset token valid for 30 minutes.
 * No email provider is configured in Phase 1, so the link is written to the
 * server log (and returned in the response only in development) — see README.
 */
export async function requestPasswordReset(email: string) {
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) return null; // don't reveal whether the email exists
  const raw = crypto.randomBytes(32).toString('base64url');
  user.resetTokenHash = sha256(raw);
  user.resetTokenExpires = new Date(Date.now() + 30 * 60_000);
  await user.save();
  const link = `${env.CLIENT_URL}/reset-password?token=${raw}`;
  logger.info('Password reset link generated', { email: user.email, link });
  return link;
}

export async function resetPassword(token: string, password: string) {
  const user = await UserModel.findOne({
    resetTokenHash: sha256(token),
    resetTokenExpires: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpires');
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.passwordChangedAt = new Date();
  user.set({ resetTokenHash: null, resetTokenExpires: null });
  await user.save();
  await revokeAllForUser(String(user._id));
}
