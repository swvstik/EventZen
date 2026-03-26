import crypto from 'node:crypto';

function getHashSecret() {
  const secret = process.env.TOKEN_HASH_SECRET;
  if (!secret) {
    throw new Error('TOKEN_HASH_SECRET must be configured for token hashing.');
  }
  return secret;
}

export function hashScopedValue(value, scope) {
  const normalized = String(value);
  return crypto
    .createHmac('sha256', getHashSecret())
    .update(`${scope}:${normalized}`)
    .digest('hex');
}

export function timingSafeEqualHex(leftHex, rightHex) {
  if (typeof leftHex !== 'string' || typeof rightHex !== 'string') {
    return false;
  }

  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');

  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function timingSafeEqualString(leftValue, rightValue) {
  if (typeof leftValue !== 'string' || typeof rightValue !== 'string') {
    return false;
  }

  const left = Buffer.from(leftValue, 'utf8');
  const right = Buffer.from(rightValue, 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}
