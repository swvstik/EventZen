import { ReviewService } from '../services/ReviewService.js';
import { ReviewRepository } from '../repositories/ReviewRepository.js';
import { RegistrationRepository } from '../repositories/RegistrationRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';

const reviewService = new ReviewService(new ReviewRepository(), new RegistrationRepository(), new UserRepository());

/**
 * ReviewController
 * Handles HTTP for event reviews.
 */
export class ReviewController {
  constructor(service = reviewService) {
    this.reviewService = service;
  }

  /** POST /api/reviews — backward-compatible create (rating and/or comment) */
  async create(req, res, next) {
    try {
      const { eventId, rating, comment } = req.body;
      if (!eventId) {
        return res.status(400).json({ success: false, message: 'eventId is required.' });
      }

      if ((rating === undefined || rating === null || rating === '') && !String(comment || '').trim()) {
        return res.status(400).json({ success: false, message: 'Either rating or comment is required.' });
      }

      const review = await this.reviewService.createReview({
        userId: req.user.userId,
        userRole: req.user.role,
        userName: req.user.email?.split('@')[0] || 'User',
        eventId,
        rating,
        comment,
      });
      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/reviews/comments — create comment (authenticated) */
  async createComment(req, res, next) {
    try {
      const { eventId, comment } = req.body;
      if (!eventId) {
        return res.status(400).json({ success: false, message: 'eventId is required.' });
      }
      if (!String(comment || '').trim()) {
        return res.status(400).json({ success: false, message: 'comment is required.' });
      }

      const created = await this.reviewService.createComment({
        userId: req.user.userId,
        userRole: req.user.role,
        userName: req.user.email?.split('@')[0] || 'User',
        eventId,
        comment,
      });

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/reviews/event/:eventId — list reviews for an event (public) */
  async getByEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const { page = 0, limit = 20 } = req.query;
      const result = await this.reviewService.getReviews(eventId, { page: Number(page), limit: Number(limit) });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/reviews/event/:eventId/rating/summary — public unique-rater summary */
  async getRatingSummary(req, res, next) {
    try {
      const summary = await this.reviewService.getRatingSummary(req.params.eventId);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/reviews/event/:eventId/rating/mine — get current user's rating (authenticated) */
  async getMyRating(req, res, next) {
    try {
      const review = await this.reviewService.getMyRating(req.user.userId, req.params.eventId);
      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/reviews/event/:eventId/mine — backward-compatible alias */
  async getMine(req, res, next) {
    return this.getMyRating(req, res, next);
  }

  /** PUT /api/reviews/event/:eventId/rating — upsert my single rating (authenticated) */
  async upsertMyRating(req, res, next) {
    try {
      const parsedRating = Number(req.body?.rating);
      if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ success: false, message: 'rating must be between 1 and 5.' });
      }

      const saved = await this.reviewService.upsertMyRating({
        userId: req.user.userId,
        userRole: req.user.role,
        userName: req.user.email?.split('@')[0] || 'User',
        eventId: req.params.eventId,
        rating: parsedRating,
      });

      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/reviews/:id — update own comment (authenticated) */
  async update(req, res, next) {
    try {
      const { comment } = req.body;
      if (comment === undefined || comment === null) {
        return res.status(400).json({ success: false, message: 'comment is required.' });
      }

      const review = await this.reviewService.updateReview(req.params.id, req.user.userId, {
        comment,
      });

      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/reviews/:id — delete own review (authenticated) */
  async remove(req, res, next) {
    try {
      await this.reviewService.deleteReview(req.params.id, {
        userId: req.user.userId,
        role: req.user.role,
      });
      res.json({ success: true, message: 'Review deleted.' });
    } catch (err) {
      next(err);
    }
  }
}
