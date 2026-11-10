import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { isRegistrationOpen } from './appSettings.service.js';
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
  // The very first person can always register; after that, respect the admin/env setting.
  const userCount = await UserModel.countDocuments({ role: 'user' });
  if (userCount > 0 && !(await isRegistrationOpen())) throw ApiError.forbidden('Registration is closed. Ask the admin for an account.');

  const exists = await UserModel.exists({ email: input.email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
    role: 'user', // admin accounts are only created from ADMIN_EMAIL/ADMIN_PASSWORD
  });
  await provisionNewUser(user._id);
  return { user, ...(await sessionFor(user, ctx)) };
}

export async function login(input: { email: string; password: string }, ctx = {}) {
  const user = await UserModel.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  // Same message for unknown email and wrong password — no account enumeration.
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }
  // only revealed after a correct password, so it doesn't leak which emails exist
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled. Contact the admin.');
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

/**
 * Creates or updates the separate admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Runs at startup. Changing ADMIN_PASSWORD on the host rotates the password
 * (and logs the admin out everywhere). Admin accounts are not provisioned with
 * tracking data — they only use the admin panel.
 */
export async function ensureAdminAccount() {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  // A server without admin config must not touch roles: several servers (laptop +
  // Render) can share one database, and an unconfigured one would otherwise
  // demote the real admin on every restart.
  if (!email || !password) {
    logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — admin account left unchanged');
    return null;
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    logger.error('ADMIN_PASSWORD must be at least 12 characters with letters and numbers — admin account left unchanged');
    return null;
  }
  // Older versions made the first registered user an admin. That personal account
  // becomes a regular user again so it keeps its tracker; only ADMIN_EMAIL is admin.
  const demoted = await UserModel.updateMany({ role: 'admin', email: { $ne: email } }, { $set: { role: 'user' } });
  if (demoted.modifiedCount) logger.info('Converted legacy admin account(s) to regular users', { count: demoted.modifiedCount });
  const existing = await UserModel.findOne({ email }).select('+passwordHash');
  if (!existing) {
    const admin = await UserModel.create({ name: 'Admin', email, role: 'admin', passwordHash: await bcrypt.hash(password, SALT_ROUNDS) });
    logger.info('Admin account created', { email });
    return admin;
  }
  let changed = false;
  if (existing.role !== 'admin') { existing.role = 'admin'; changed = true; }
  if (!existing.isActive) { existing.isActive = true; changed = true; }
  if (!(await bcrypt.compare(password, existing.passwordHash))) {
    existing.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    existing.passwordChangedAt = new Date();
    await revokeAllForUser(String(existing._id));
    changed = true;
  }
  if (changed) { await existing.save(); logger.info('Admin account updated', { email }); }
  return existing;
}
