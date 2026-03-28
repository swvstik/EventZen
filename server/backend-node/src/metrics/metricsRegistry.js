import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'eventzen_node_',
});

const httpRequestsTotal = new client.Counter({
  name: 'eventzen_node_http_requests_total',
  help: 'Total number of HTTP requests handled by the Node service',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'eventzen_node_http_request_duration_seconds',
  help: 'HTTP request duration in seconds for the Node service',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

function normalizeRoute(route) {
  return route
    .replace(/[0-9a-fA-F]{24}/g, ':id')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}/g, ':id')
    .replace(/\/\d+/g, '/:id');
}

export function observeHttpRequest({ method, route, statusCode, durationSeconds }) {
  const labels = {
    method,
    route: normalizeRoute(route || 'unknown'),
    status_code: String(statusCode || 0),
  };

  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, durationSeconds);
}

export function getMetricsRegistry() {
  return register;
}
