export function globalErrorHandler(err, req, res, next) {
  // Mongoose duplicate key
  if (err.code === 11000) {
    const raw = String(err?.message || '');

    if (raw.includes('unique_active_registration')) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active registration for this event tier.',
      });
    }

    if (raw.includes('unique_waitlist_position')) {
      return res.status(409).json({
        success: false,
        message: 'Waitlist ordering changed due to concurrent registrations. Please retry.',
      });
    }

    if (raw.includes('unique_pending_vendor_application')) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending vendor application.',
      });
    }

    const field = Object.keys(err.keyValue || {})[0] || 'field';
    if (field === 'email') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    return res.status(409).json({ success: false, message: `Duplicate value for ${field}.` });
  }
  // Mongoose validation
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map(e => e.message)[0];
    return res.status(400).json({ success: false, message: msg });
  }
  // Bad ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }
  // Our AppError
  if (err.isOperational) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  // Unexpected - log, don't leak
  console.error('Unexpected error:', err);
  res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
}
