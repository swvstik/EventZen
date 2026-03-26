import { TokenService } from '../services/TokenService.js';
import AppError from '../utils/AppError.js';

const tokenService = new TokenService();

/**
 * authenticate
 * Verifies JWT access token from Authorization: Bearer header.
 * Attaches req.user = { userId, email, role }.
 *
 * Tokens are only issued after email verification (in verifyEmail()),
 * so any valid token implicitly means isEmailVerified = true.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query?.accessToken === 'string' ? req.query.accessToken : null;

  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return next(AppError.unauthorized('No token provided. Please log in.'));
  }

  try {
    const decoded = tokenService.verifyAccessToken(token);
    req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireRole(...roles)
 * Must come after authenticate.
 * Usage: requireRole('ADMIN')  or  requireRole('VENDOR', 'ADMIN')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(
        `Access denied. Requires: ${roles.join(' or ')}. You are: ${req.user.role}`
      ));
    }
    next();
  };
}
