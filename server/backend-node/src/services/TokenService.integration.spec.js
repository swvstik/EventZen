import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-token-service';

const { TokenService } = await import('./TokenService.js');

test('TokenService integration: signed access token can be verified end-to-end', () => {
  const svc = new TokenService();
  const payload = { userId: 'integration-u1', email: 'integration@example.com', role: 'VENDOR' };

  const token = svc.signAccessToken(payload);
  const decoded = svc.verifyAccessToken(token);

  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.role, payload.role);
  assert.ok(typeof decoded.exp === 'number');
  assert.ok(typeof decoded.iat === 'number');
});

test('TokenService integration: malformed token fails verification', () => {
  const svc = new TokenService();

  assert.throws(() => svc.verifyAccessToken('not-a-jwt-token'), (err) => {
    assert.equal(err.statusCode, 401);
    assert.match(err.message, /Invalid access token|Access token expired/i);
    return true;
  });
});
