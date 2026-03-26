import crypto from 'crypto';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { hashScopedValue } from '../utils/secretHash.js';

export class PasswordResetTokenRepository {

  async create(userId) {
    // Delete any existing reset token for this user first
    await PasswordResetToken.deleteMany({ userId });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashScopedValue(token, 'password-reset-token');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await PasswordResetToken.create({ userId, tokenHash, expiresAt });
    return token;
  }

  async findByToken(token) {
    const tokenHash = hashScopedValue(token, 'password-reset-token');
    return PasswordResetToken.findOne({
      $or: [{ tokenHash }, { token }],
    });
  }

  async deleteByToken(token) {
    const tokenHash = hashScopedValue(token, 'password-reset-token');
    return PasswordResetToken.deleteOne({
      $or: [{ tokenHash }, { token }],
    });
  }
}
