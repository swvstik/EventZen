export function withCacheBust(imageUrl, versionToken) {
  if (!imageUrl) return '';

  const token = versionToken ?? Date.now();

  try {
    const parsed = new URL(imageUrl, window.location.origin);
    parsed.searchParams.set('evzv', String(token));

    if (/^https?:\/\//i.test(imageUrl)) {
      return parsed.toString();
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}evzv=${encodeURIComponent(String(token))}`;
  }
}