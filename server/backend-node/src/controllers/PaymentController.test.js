import test from 'node:test';
import assert from 'node:assert/strict';

import { PaymentController } from './PaymentController.js';
import { PaymentService } from '../services/PaymentService.js';

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

test('PaymentController webhook rejects invalid payload', async () => {
  const controller = new PaymentController();
  const req = { body: null };
  const res = createMockRes();

  let nextErr = null;
  await controller.webhook(req, res, (err) => {
    nextErr = err || null;
  });

  assert.ok(nextErr);
  assert.equal(nextErr.statusCode, 400);
  assert.match(nextErr.message, /invalid webhook payload/i);
});

test('PaymentController getPlatformFeeAggregatesInternal requires non-empty eventIds', async () => {
  const controller = new PaymentController();
  const req = { body: { eventIds: [] } };
  const res = createMockRes();

  let nextErr = null;
  await controller.getPlatformFeeAggregatesInternal(req, res, (err) => {
    nextErr = err || null;
  });

  assert.ok(nextErr);
  assert.equal(nextErr.statusCode, 400);
  assert.match(nextErr.message, /eventids/i);
});

test('PaymentController getPlatformFeeAggregatesInternal forwards normalized ids', async () => {
  const original = PaymentService.prototype.getPlatformFeeAggregatesForEvents;
  PaymentService.prototype.getPlatformFeeAggregatesForEvents = async (ids) =>
    ids.map((id) => ({ eventId: id, platformFeeMinor: 10 }));

  try {
    const controller = new PaymentController();
    const req = { body: { eventIds: [' evt-1 ', '', 'evt-2'] } };
    const res = createMockRes();

    await controller.getPlatformFeeAggregatesInternal(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.deepEqual(res.payload.data, [
      { eventId: 'evt-1', platformFeeMinor: 10 },
      { eventId: 'evt-2', platformFeeMinor: 10 },
    ]);
  } finally {
    PaymentService.prototype.getPlatformFeeAggregatesForEvents = original;
  }
});
