function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getSafeRedirectPath(pathname, fallback = '/') {
  if (typeof pathname !== 'string') return fallback;

  const path = pathname.trim();
  if (!path) return fallback;

  // Prevent open redirects and protocol-relative hops.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return fallback;
  }

  return path;
}

export function parseAuthPayload(payload) {
  const source = isRecord(payload) ? payload : {};
  const nested = isRecord(source.data) ? source.data : source;

  const user = isRecord(nested.user) ? nested.user : null;
  const accessToken = typeof nested.accessToken === 'string' ? nested.accessToken : null;
  const refreshToken = typeof nested.refreshToken === 'string' ? nested.refreshToken : null;

  return { user, accessToken, refreshToken };
}
