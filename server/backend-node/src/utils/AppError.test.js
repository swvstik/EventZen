import test from 'node:test';
import assert from 'node:assert/strict';
import AppError from './AppError.js';

test('AppError.badRequest sets 400 status', () => {
  const err = AppError.badRequest('bad input');
  assert.equal(err.statusCode, 400);
  assert.equal(err.message, 'bad input');
  assert.equal(err.isOperational, true);
});

test('AppError.unauthorized uses default message', () => {
  const err = AppError.unauthorized();
  assert.equal(err.statusCode, 401);
  assert.equal(err.message, 'Authentication required');
});

test('AppError.notFound sets 404 status', () => {
  const err = AppError.notFound('missing');
  assert.equal(err.statusCode, 404);
  assert.equal(err.message, 'missing');
});
