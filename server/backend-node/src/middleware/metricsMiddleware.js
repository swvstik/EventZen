import { observeHttpRequest } from '../metrics/metricsRegistry.js';

export default function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const routePath = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : `${req.baseUrl || ''}${req.path || ''}`;

    observeHttpRequest({
      method: req.method,
      route: routePath || req.originalUrl || 'unknown',
      statusCode: res.statusCode,
      durationSeconds,
    });
  });

  next();
}
