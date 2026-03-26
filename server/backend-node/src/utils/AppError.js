/**
 * AppError
 * Custom error class that carries an HTTP status code.
 * Throwing one of these anywhere in the app is caught by globalErrorHandler
 * and returned to the client as a clean JSON response.
 *
 * Usage:
 *   throw AppError.conflict('Email already in use');
 *   throw AppError.forbidden('Admin only');
 *   throw new AppError('Custom message', 418);
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode   = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg)   { return new AppError(msg, 400); }
  static unauthorized(msg) { return new AppError(msg || 'Authentication required', 401); }
  static forbidden(msg)    { return new AppError(msg || 'Access denied', 403); }
  static notFound(msg)     { return new AppError(msg || 'Not found', 404); }
  static conflict(msg)     { return new AppError(msg, 409); }
  static serviceUnavailable(msg) { return new AppError(msg || 'Service temporarily unavailable', 503); }
  static internal(msg)     { return new AppError(msg || 'Something went wrong', 500); }
}

export default AppError;
