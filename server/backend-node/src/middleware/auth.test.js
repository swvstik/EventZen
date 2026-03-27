import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-auth-middleware';

const { authenticate, requireRole } = await import('./auth.js');
const { TokenService } = await import('../services/TokenService.js');

function createResponseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('authenticate attaches req.user for valid bearer token', async () => {
  const svc = new TokenService();
  const token = svc.signAccessToken({ userId: 'u-1', email: 'a@b.com', role: 'ADMIN' });

  const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
  const res = createResponseStub();

  let nextCalled = false;
  let nextError = null;

  authenticate(req, res, (err) => {
    nextCalled = true;
    nextError = err || null;
  });

  assert.equal(nextCalled, true);
  assert.equal(nextError, null);
  assert.equal(req.user.userId, 'u-1');
  assert.equal(req.user.role, 'ADMIN');
});

test('authenticate accepts accessToken from query when authorization header is absent', async () => {
  const svc = new TokenService();
  const token = svc.signAccessToken({ userId: 'u-2', email: 'q@b.com', role: 'VENDOR' });

  const req = { headers: {}, query: { accessToken: token } };
  const res = createResponseStub();

  let nextError = null;
  authenticate(req, res, (err) => {
    nextError = err || null;
  });

  assert.equal(nextError, null);
  assert.equal(req.user.userId, 'u-2');
  assert.equal(req.user.role, 'VENDOR');
});

test('authenticate returns unauthorized error when token is missing', () => {
  const req = { headers: {}, query: {} };
  const res = createResponseStub();

  let nextError = null;
  authenticate(req, res, (err) => {
    nextError = err || null;
  });

  assert.ok(nextError);
  assert.equal(nextError.statusCode, 401);
  assert.match(nextError.message, /No token provided/i);
});

test('requireRole allows users with matching role', () => {
  const req = { user: { role: 'ADMIN' } };
  const res = createResponseStub();

  let nextError = null;
  requireRole('ADMIN', 'VENDOR')(req, res, (err) => {
    nextError = err || null;
  });

  assert.equal(nextError, null);
});

test('requireRole blocks users with non-matching role', () => {
  const req = { user: { role: 'CUSTOMER' } };
  const res = createResponseStub();

  let nextError = null;
  requireRole('ADMIN', 'VENDOR')(req, res, (err) => {
    nextError = err || null;
  });

  assert.ok(nextError);
  assert.equal(nextError.statusCode, 403);
  assert.match(nextError.message, /Access denied/i);
});
