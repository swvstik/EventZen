import test from 'node:test';
import assert from 'node:assert/strict';

import { InternalNotificationController } from './InternalNotificationController.js';
import { UserRepository } from '../repositories/UserRepository.js';
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

test('InternalNotificationController notifyStatusChange requires vendorUserId', async () => {
  const controller = new InternalNotificationController();
  const req = {
    params: { eventId: 'evt-1' },
    body: { eventTitle: 'Demo', status: 'PUBLISHED' },
  };
  const res = createMockRes();

  let nextErr = null;
  await controller.notifyStatusChange(req, res, (err) => {
    nextErr = err || null;
  });

  assert.ok(nextErr);
  assert.equal(nextErr.statusCode, 400);
  assert.match(nextErr.message, /vendorUserId is required/i);
});

test('InternalNotificationController notifyPendingApproval fans out to admins', async () => {
  const findByRoleOriginal = UserRepository.prototype.findByRole;
  const createNotifOriginal = NotificationService.prototype.createNotification;

  UserRepository.prototype.findByRole = async () => [{ _id: 'a-1' }, { _id: 'a-2' }];
  const deliveries = [];
  NotificationService.prototype.createNotification = async (userId, eventId, type, message) => {
    deliveries.push({ userId, eventId, type, message });
    return { _id: `${userId}-${eventId}` };
  };

  try {
    const controller = new InternalNotificationController();
    const req = {
      params: { eventId: 'evt-1' },
      body: { eventTitle: 'Demo Event', vendorUserId: 'vendor-1' },
    };
    const res = createMockRes();

    await controller.notifyPendingApproval(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.data.deliveredTo, 2);
    assert.equal(deliveries.length, 2);
    assert.equal(deliveries[0].type, 'EVENT_PENDING_APPROVAL');
  } finally {
    UserRepository.prototype.findByRole = findByRoleOriginal;
    NotificationService.prototype.createNotification = createNotifOriginal;
  }
});
