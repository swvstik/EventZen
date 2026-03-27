import test from 'node:test';
import assert from 'node:assert/strict';

import { ReviewController } from './ReviewController.js';

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

test('ReviewController upsertMyRating validates out-of-range rating', async () => {
  const controller = new ReviewController({
    upsertMyRating: async () => ({ _id: 'should-not-be-called' }),
  });

  const req = {
    user: { userId: 'u-1', role: 'USER', email: 'user@example.com' },
    params: { eventId: 'e-1' },
    body: { rating: 6 },
  };
  const res = createMockRes();

  await controller.upsertMyRating(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /rating must be between 1 and 5/i);
});

test('ReviewController upsertMyRating forwards payload to service', async () => {
  let captured = null;
  const controller = new ReviewController({
    upsertMyRating: async (payload) => {
      captured = payload;
      return { _id: 'rating-1', rating: 4 };
    },
  });

  const req = {
    user: { userId: 'u-1', role: 'USER', email: 'john@eventzen.com' },
    params: { eventId: 'e-1' },
    body: { rating: 4 },
  };
  const res = createMockRes();

  await controller.upsertMyRating(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.rating, 4);
  assert.deepEqual(captured, {
    userId: 'u-1',
    userRole: 'USER',
    userName: 'john',
    eventId: 'e-1',
    rating: 4,
  });
});

test('ReviewController createComment requires non-empty comment', async () => {
  const controller = new ReviewController({
    createComment: async () => ({ _id: 'comment-1' }),
  });

  const req = {
    user: { userId: 'u-1', role: 'USER', email: 'user@example.com' },
    body: { eventId: 'e-1', comment: '   ' },
  };
  const res = createMockRes();

  await controller.createComment(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /comment is required/i);
});

test('ReviewController create supports legacy mixed payload', async () => {
  const controller = new ReviewController({
    createReview: async () => ({
      rating: { _id: 'r-1', rating: 5 },
      comment: { _id: 'c-1', comment: 'Great event' },
    }),
  });

  const req = {
    user: { userId: 'u-1', role: 'USER', email: 'user@example.com' },
    body: { eventId: 'e-1', rating: 5, comment: 'Great event' },
  };
  const res = createMockRes();

  await controller.create(req, res, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.rating.rating, 5);
  assert.equal(res.payload.data.comment.comment, 'Great event');
});

test('ReviewController update requires comment field', async () => {
  const controller = new ReviewController({
    updateReview: async () => ({ _id: 'comment-1', comment: 'updated' }),
  });

  const req = {
    user: { userId: 'u-1' },
    params: { id: 'comment-1' },
    body: {},
  };
  const res = createMockRes();

  await controller.update(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /comment is required/i);
});

test('ReviewController getRatingSummary returns unique rater count', async () => {
  const controller = new ReviewController({
    getRatingSummary: async () => ({ avgRating: 4.5, count: 12 }),
  });

  const req = {
    params: { eventId: 'e-1' },
  };
  const res = createMockRes();

  await controller.getRatingSummary(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.avgRating, 4.5);
  assert.equal(res.payload.data.count, 12);
});
