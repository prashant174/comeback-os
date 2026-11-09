import { Schema, model, Types } from 'mongoose';
/**
 * Refresh tokens are stored hashed. Each login starts a "family".
 * On rotation the old token is marked replaced; if a replaced token is
 * presented again (reuse = likely theft) the whole family is revoked.
 */
const refreshTokenSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
}, { timestamps: true });
// Mongo TTL cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
//# sourceMappingURL=RefreshToken.js.map