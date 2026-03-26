import { ReviewService } from '../services/ReviewService.js';
import { ReviewRepository } from '../repositories/ReviewRepository.js';
import { RegistrationRepository } from '../repositories/RegistrationRepository.js';

const reviewService = new ReviewService(new ReviewRepository(), new RegistrationRepository());

/**
 * ReviewController
 * Handles HTTP for event reviews.
 */
export class ReviewController {

  /** POST /api/reviews — create a review (authenticated) */
  async create(req, res, next) {
    try {
      const { eventId, rating, comment } = req.body;
      if (!eventId || !rating) {
        return res.status(400).json({ success: false, message: 'eventId and rating are required.' });
      }
      const review = await reviewService.createReview({
        userId: req.user.userId,
        userRole: req.user.role,
        userName: req.user.email?.split('@')[0] || 'User',
        eventId,
        rating: Number(rating),
        comment,
      });
      res.status(201).json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/reviews/event/:eventId — list reviews for an event (public) */
  async getByEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const { page = 0, limit = 20 } = req.query;
      const result = await reviewService.getReviews(eventId, { page: Number(page), limit: Number(limit) });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/reviews/event/:eventId/mine — get current user's review (authenticated) */
  async getMine(req, res, next) {
    try {
      const review = await reviewService.getMyReview(req.user.userId, req.params.eventId);
      res.json({ success: true, data: review });
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/reviews/:id — update own review (authenticated) */
  async update(req, res, next) {
    try {
      const { rating, comment } = req.body;
      const parsedRating = Number(rating);
      if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ success: false, message: 'rating must be between 1 and 5.' });
      }

      const review = await reviewService.updateReview(req.params.id, req.user.userId, {
        rating: parsedRating,
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
      await reviewService.deleteReview(req.params.id, {
        userId: req.user.userId,
        role: req.user.role,
      });
      res.json({ success: true, message: 'Review deleted.' });
    } catch (err) {
      next(err);
    }
  }
}
