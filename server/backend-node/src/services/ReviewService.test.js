import test from 'node:test';
import assert from 'node:assert/strict';

import { ReviewService } from './ReviewService.js';

test('ReviewService allows multiple reviews from same user for same event', async () => {
  const created = [];
  const service = new ReviewService(
    {
      create: async (payload) => {
        created.push(payload);
        return { _id: `review-${created.length}`, ...payload };
      },
    },
    {
      findByUserId: async () => [{ eventId: 'evt-1', status: 'REGISTERED' }],
    }
  );

  service.syncRatingToSpring = async () => {};

  const first = await service.createReview({
    userId: 'user-1',
    userRole: 'USER',
    userName: 'Alex',
    eventId: 'evt-1',
    rating: 5,
    comment: 'Great event',
  });

  const second = await service.createReview({
    userId: 'user-1',
    userRole: 'USER',
    userName: 'Alex',
    eventId: 'evt-1',
    rating: 4,
    comment: 'Updated thoughts',
  });

  assert.equal(first._id, 'review-1');
  assert.equal(second._id, 'review-2');
  assert.equal(created.length, 2);
  assert.equal(created[0].eventId, 'evt-1');
  assert.equal(created[1].eventId, 'evt-1');
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
    service.createReview({
      userId: 'user-2',
      userRole: 'USER',
      userName: 'Jamie',
      eventId: 'evt-1',
      rating: 3,
      comment: 'Not allowed',
    }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /must be registered/i);
      return true;
    }
  );
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
