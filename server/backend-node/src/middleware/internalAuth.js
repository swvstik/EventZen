import AppError from '../utils/AppError.js';
import { timingSafeEqualString } from '../utils/secretHash.js';

/**
 * Protects internal service endpoints used by other backends.
 * Requires header: X-Internal-Secret
 */
export function authenticateInternal(req, res, next) {
  const provided = req.get('x-internal-secret');
  const expected = process.env.INTERNAL_SERVICE_SECRET;

  if (!expected) {
    return next(AppError.internal('INTERNAL_SERVICE_SECRET is not configured.'));
  }

  if (!provided || !timingSafeEqualString(provided, expected)) {
    return next(AppError.unauthorized('Invalid internal service secret.'));
  }

  return next();
}
