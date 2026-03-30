import test from 'node:test';
import assert from 'node:assert/strict';

import { NotificationController } from './NotificationController.js';
import { NotificationService } from '../services/NotificationService.js';

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

test('NotificationController getUnreadCount returns wrapped payload', async () => {
  const original = NotificationService.prototype.getUnreadCount;
  NotificationService.prototype.getUnreadCount = async () => 7;

  try {
    const controller = new NotificationController();
    const req = { user: { userId: 'u-1' } };
    const res = createMockRes();

    await controller.getUnreadCount(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.data.count, 7);
  } finally {
    NotificationService.prototype.getUnreadCount = original;
  }
});

test('NotificationController markAllRead returns updated count', async () => {
  const original = NotificationService.prototype.markAllRead;
  NotificationService.prototype.markAllRead = async () => 3;

  try {
    const controller = new NotificationController();
    const req = { user: { userId: 'u-1' } };
    const res = createMockRes();

    await controller.markAllRead(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.data.updated, 3);
  } finally {
    NotificationService.prototype.markAllRead = original;
  }
});
