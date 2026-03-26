import test from 'node:test';
import assert from 'node:assert/strict';
import { handleNotificationLifecycleEvent, processNotificationLifecycleMessage } from './notificationEventConsumer.js';
import { TOPICS } from './topics.js';

test('handles EVENT_PENDING_APPROVAL by notifying all admins', async () => {
  const calls = [];
  const deps = {
    userRepo: {
      findByRole: async () => ([{ _id: 'admin-1' }, { _id: 'admin-2' }]),
    },
    notifSvc: {
      createNotification: async (...args) => {
        calls.push(args);
      },
    },
  };

  await handleNotificationLifecycleEvent({
    eventType: 'EVENT_PENDING_APPROVAL',
    eventId: '42',
    eventTitle: 'Spring Fest',
    vendorUserId: 'vendor-1',
  }, deps);

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'admin-1');
  assert.equal(calls[1][0], 'admin-2');
  assert.equal(calls[0][1], '42');
  assert.equal(calls[0][2], 'EVENT_PENDING_APPROVAL');
});

test('handles EVENT_STATUS_DECISION by notifying vendor', async () => {
  const calls = [];
  const deps = {
    notifSvc: {
      createNotification: async (...args) => {
        calls.push(args);
      },
    },
  };

  await handleNotificationLifecycleEvent({
    eventType: 'EVENT_STATUS_DECISION',
    eventId: '42',
    eventTitle: 'Spring Fest',
    vendorUserId: 'vendor-7',
    status: 'PUBLISHED',
  }, deps);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'vendor-7');
  assert.equal(calls[0][1], '42');
  assert.equal(calls[0][2], 'EVENT_APPROVED');
});

test('routes failed lifecycle handling to DLQ with original key', async () => {
  const publishCalls = [];

  await processNotificationLifecycleMessage(
    {
      key: 'event-42',
      payload: { eventId: '42', eventType: 'EVENT_STATUS_DECISION' },
    },
    {
      handleNotificationLifecycleEvent: async () => {
        throw new Error('simulated-handler-failure');
      },
      publishEvent: async (...args) => {
        publishCalls.push(args);
      },
    }
  );

  assert.equal(publishCalls.length, 1);
  assert.equal(publishCalls[0][0], TOPICS.DLQ);
  assert.equal(publishCalls[0][1], 'event-42');
  assert.equal(publishCalls[0][2].sourceTopic, TOPICS.EVENT_LIFECYCLE);
  assert.equal(publishCalls[0][2].error, 'simulated-handler-failure');
});

test('uses fallback DLQ key when message key is missing', async () => {
  const publishCalls = [];

  await processNotificationLifecycleMessage(
    {
      payload: { eventId: '99', eventType: 'EVENT_PENDING_APPROVAL' },
    },
    {
      handleNotificationLifecycleEvent: async () => {
        throw new Error('failure-no-key');
      },
      publishEvent: async (...args) => {
        publishCalls.push(args);
      },
    }
  );

  assert.equal(publishCalls.length, 1);
  assert.equal(publishCalls[0][1], 'notification-lifecycle');
  assert.equal(publishCalls[0][2].error, 'failure-no-key');
});
