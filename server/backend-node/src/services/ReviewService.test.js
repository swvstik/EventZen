import test from 'node:test';
import assert from 'node:assert/strict';

import { ReviewService } from './ReviewService.js';

test('upsertMyRating keeps one rating entry per user/event', async () => {
  const ratingStore = new Map();
  let syncCount = 0;

  const service = new ReviewService(
    {
      upsertUserRating: async ({ userId, eventId, rating }) => {
        const key = `${userId}:${eventId}`;
        const next = { _id: key, userId, eventId, rating };
        ratingStore.set(key, next);
        return next;
      },
    },
    {
      findByUserId: async () => [{ eventId: 'evt-1', status: 'REGISTERED' }],
    }
  );

  service.syncRatingToSpring = async () => {
    syncCount += 1;
  };

  await service.upsertMyRating({
    userId: 'user-1',
    userRole: 'USER',
    userName: 'Alex',
    eventId: 'evt-1',
    rating: 5,
  });

  await service.upsertMyRating({
    userId: 'user-1',
    userRole: 'USER',
    userName: 'Alex',
    eventId: 'evt-1',
    rating: 3,
  });

  assert.equal(ratingStore.size, 1);
  assert.equal(ratingStore.get('user-1:evt-1').rating, 3);
  assert.equal(syncCount, 2);
});

test('createComment allows multiple comments per user/event', async () => {
  const created = [];
  const service = new ReviewService(
    {
      create: async (payload) => {
        created.push(payload);
        return { _id: `comment-${created.length}`, ...payload };
      },
    },
    {
      findByUserId: async () => [{ eventId: 'evt-1', status: 'REGISTERED' }],
    }
  );

  const first = await service.createComment({
    userId: 'user-1',
    userRole: 'USER',
    userName: 'Alex',
    eventId: 'evt-1',
    comment: 'First comment',
  });

  const second = await service.createComment({
    userId: 'user-1',
    userRole: 'USER',
    userName: 'Alex',
    eventId: 'evt-1',
    comment: 'Second comment',
  });

  assert.equal(first._id, 'comment-1');
  assert.equal(second._id, 'comment-2');
  assert.equal(created.length, 2);
});

test('ReviewService rejects review when attendee is not registered', async () => {
  const service = new ReviewService(
    {
      create: async () => {
        throw new Error('create should not be called');
      },
    },
    {
      findByUserId: async () => [{ eventId: 'evt-2', status: 'CANCELLED' }],
    }
  );

  await assert.rejects(
    service.createComment({
      userId: 'user-2',
      userRole: 'USER',
      userName: 'Jamie',
      eventId: 'evt-1',
      comment: 'Not allowed',
    }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /must be registered/i);
      return true;
    }
  );
});

test('syncRatingToSpring uses unique-user rating aggregate', async () => {
  const originalPatch = (await import('axios')).default.patch;
  const axiosModule = (await import('axios')).default;

  let patchedPayload = null;

  const service = new ReviewService(
    {
      calcAvgRatingUniqueUsers: async () => ({ avgRating: 4.25, count: 2 }),
    },
    {
      findByUserId: async () => [],
    }
  );

  service.internalSecret = 'internal-secret';
  service.springBaseUrl = 'http://localhost:8082';

  axiosModule.patch = async (_url, payload) => {
    patchedPayload = payload;
    return { data: { success: true } };
  };

  try {
    await service.syncRatingToSpring('evt-1');
    assert.deepEqual(patchedPayload, { avgRating: 4.25 });
  } finally {
    axiosModule.patch = originalPatch;
  }
});

test('ReviewService lets admin delete another user review', async () => {
  let deletedId = null;
  const service = new ReviewService(
    {
      findById: async () => ({ _id: 'rev-3', userId: 'user-3', eventId: 'evt-9' }),
      deleteById: async (id) => {
        deletedId = id;
        return true;
      },
    },
    {
      findByUserId: async () => [],
    }
  );

  service.syncRatingToSpring = async () => {};

  const deleted = await service.deleteReview('rev-3', { userId: 'admin-1', role: 'ADMIN' });

  assert.equal(deleted, true);
  assert.equal(deletedId, 'rev-3');
});
