import jwt from 'jsonwebtoken';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository.js';
import AppError from '../utils/AppError.js';

/**
 * TokenService
 * Owns all JWT and refresh token logic.
 * Access tokens: short-lived JWTs signed with JWT_SECRET (15 min).
 * Refresh tokens: opaque UUIDs stored in MongoDB with 7-day TTL.
 * Spring Boot and ASP.NET use the same JWT_SECRET to verify access tokens.
 */
export class TokenService {
  constructor() {
    this.refreshTokenRepo = new RefreshTokenRepository();
    this.secret = process.env.JWT_SECRET;
    if (!this.secret) throw new Error('JWT_SECRET is not set');
  }

  // -- Access token --------------------------------------------------------

  signAccessToken(payload) {
    // payload: { userId, email, role }
    return jwt.sign(payload, this.secret, { expiresIn: '15m' });
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw AppError.unauthorized('Access token expired');
      throw AppError.unauthorized('Invalid access token');
    }
  }

  // -- Refresh token -------------------------------------------------------

  async createRefreshToken(userId) {
    return this.refreshTokenRepo.create(userId);
  }

  /**
   * Find, delete, and return the userId from a refresh token.
   * Deletion is the "rotation" - old token is invalidated immediately.
   * Returns null if token not found (expired TTL or already used).
   */
  async findAndDeleteRefreshToken(token) {
    const doc = await this.refreshTokenRepo.findByToken(token);
    if (!doc) return null;
    await this.refreshTokenRepo.deleteByToken(token);
    return doc.userId.toString();
  }

  async deleteRefreshToken(token) {
    return this.refreshTokenRepo.deleteByToken(token);
  }

  async deleteAllRefreshTokensForUser(userId) {
    return this.refreshTokenRepo.deleteAllForUser(userId);
  }
}
