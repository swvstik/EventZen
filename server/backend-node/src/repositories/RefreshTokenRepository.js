import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import { hashScopedValue } from '../utils/secretHash.js';

export class RefreshTokenRepository {

  async create(userId) {
    const token     = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashScopedValue(token, 'refresh-token');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({ userId, tokenHash, expiresAt });
    return token;
  }

  async findByToken(token) {
    const tokenHash = hashScopedValue(token, 'refresh-token');
    return RefreshToken.findOne({
      $or: [{ tokenHash }, { token }],
    });
  }

  async deleteByToken(token) {
    const tokenHash = hashScopedValue(token, 'refresh-token');
    return RefreshToken.deleteOne({
      $or: [{ tokenHash }, { token }],
    });
  }

  async deleteAllForUser(userId) {
    return RefreshToken.deleteMany({ userId });
  }
}
