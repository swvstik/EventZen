import rateLimit from 'express-rate-limit';

function createJsonLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });
}

export const apiLimiter = createJsonLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  message: 'Too many API requests. Please retry in a few minutes.',
});

export const authLimiter = createJsonLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please wait before trying again.',
});
