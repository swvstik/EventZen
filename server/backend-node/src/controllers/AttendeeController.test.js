import test from 'node:test';
import assert from 'node:assert/strict';

import { AttendeeController } from './AttendeeController.js';
import { PaymentService } from '../services/PaymentService.js';
import { RegistrationService } from '../services/RegistrationService.js';

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test('AttendeeController register validates eventId and tierId', async () => {
  const controller = new AttendeeController();
  const req = {
    user: { userId: 'u-1', email: 'u@example.com' },
    body: { eventId: 'evt-1' },
    get: () => 'http://localhost:8080',
  };
  const res = createMockRes();

  let nextErr = null;
  await controller.register(req, res, (err) => {
    nextErr = err || null;
  });

  assert.ok(nextErr);
  assert.equal(nextErr.statusCode, 400);
  assert.match(nextErr.message, /eventId and tierId are required/i);
});

test('AttendeeController register returns 202 when payment is required', async () => {
  const originalCheckout = PaymentService.prototype.maybeCreateCheckout;
  const originalRegister = RegistrationService.prototype.register;

  PaymentService.prototype.maybeCreateCheckout = async () => ({
    requiresPayment: true,
    orderId: 'ord-1',
    checkoutId: 'chk-1',
    checkoutUrl: 'https://checkout.example',
    subtotalMinor: 1000,
    platformFeeMinor: 100,
    amountMinor: 1100,
    currency: 'LKR',
  });

  RegistrationService.prototype.register = async () => {
    throw new Error('register should not be called when payment is required');
  };

  try {
    const controller = new AttendeeController();
    const req = {
      user: { userId: 'u-1', email: 'u@example.com' },
      body: { eventId: 'evt-1', tierId: 'tier-1', quantity: 2 },
      get: () => 'http://localhost:8080',
    };
    const res = createMockRes();

    await controller.register(req, res, () => {});

    assert.equal(res.statusCode, 202);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.data.requiresPayment, true);
    assert.equal(res.payload.data.orderId, 'ord-1');
  } finally {
    PaymentService.prototype.maybeCreateCheckout = originalCheckout;
    RegistrationService.prototype.register = originalRegister;
  }
});
