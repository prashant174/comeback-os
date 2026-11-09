import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
export const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
export function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.ACCESS_TOKEN_TTL,
        issuer: 'comeback-os',
    });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'comeback-os' });
}
/** Creates a new opaque refresh token (returned raw once; stored hashed). */
export async function issueRefreshToken(userId, family = crypto.randomUUID(), ctx = {}) {
    const raw = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400_000);
    await RefreshTokenModel.create({
        user: userId,
        tokenHash: sha256(raw),
        family,
        expiresAt,
        userAgent: ctx.userAgent?.slice(0, 200) ?? null,
        ip: ctx.ip ?? null,
    });
    return { raw, expiresAt };
}
/**
 * Rotate: validate presented token, revoke it, issue a new one in the same family.
 * Reuse of an already-rotated token revokes the entire family.
 */
export async function rotateRefreshToken(raw, ctx = {}) {
    const doc = await RefreshTokenModel.findOne({ tokenHash: sha256(raw) });
    if (!doc)
        throw ApiError.unauthorized('Invalid refresh token');
    if (doc.revokedAt) {
        // Token reuse detected — kill every session in this family.
        await RefreshTokenModel.updateMany({ family: doc.family, revokedAt: null }, { revokedAt: new Date() });
        throw ApiError.unauthorized('Refresh token reuse detected. Please log in again.');
    }
    if (doc.expiresAt.getTime() < Date.now())
        throw ApiError.unauthorized('Refresh token expired');
    const next = await issueRefreshToken(String(doc.user), doc.family, ctx);
    doc.revokedAt = new Date();
    doc.replacedBy = sha256(next.raw);
    await doc.save();
    return { userId: String(doc.user), ...next };
}
export async function revokeRefreshToken(raw) {
    await RefreshTokenModel.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { revokedAt: new Date() });
}
export async function revokeAllForUser(userId) {
    await RefreshTokenModel.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}
//# sourceMappingURL=token.service.js.map