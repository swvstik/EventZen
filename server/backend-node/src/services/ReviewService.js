import axios from 'axios';
import AppError from '../utils/AppError.js';

/**
 * ReviewService
 * Business logic for event reviews/ratings.
 * After each create/delete, syncs the new average to Spring via internal API.
 */
export class ReviewService {

  /**
   * @param {import('../repositories/ReviewRepository.js').ReviewRepository} reviewRepo
   * @param {import('../repositories/RegistrationRepository.js').RegistrationRepository} registrationRepo
   * @param {{ findById?: (id: string) => Promise<any> }} userRepo
   */
  constructor(reviewRepo, registrationRepo, userRepo = { findById: async () => null }) {
    this.reviewRepo = reviewRepo;
    this.registrationRepo = registrationRepo;
    this.userRepo = userRepo;
    this.springBaseUrl = process.env.SPRING_BASE_URL || process.env.SPRING_SERVICE_URL || 'http://localhost:8082';
    this.internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    this.springClient = axios.create({
      baseURL: this.springBaseUrl,
      timeout: 5000,
    });
  }

  async resolveAuthorProfile(userId, fallbackName) {
    const defaultName = String(fallbackName || '').trim() || 'Anonymous';

    try {
      const user = await this.userRepo?.findById?.(userId);
      if (!user) {
        return { userName: defaultName, userAvatarUrl: null };
      }

      const userName = String(user?.name || '').trim() || defaultName;
      const userAvatarUrl = user?.avatarUrl || null;
      return { userName, userAvatarUrl };
    } catch {
      return { userName: defaultName, userAvatarUrl: null };
    }
  }

  async ensureReviewEligibility({ userId, userRole, eventId }) {
    const normalizedRole = String(userRole || '').toUpperCase();

    if (normalizedRole !== 'ADMIN') {
      let vendorOwnsEvent = false;
      if (normalizedRole === 'VENDOR') {
        vendorOwnsEvent = await this._isVendorEventOwner(userId, eventId);
      }

      if (!vendorOwnsEvent) {
    // Check if user has a registration for this event
        const registrations = await this.registrationRepo.findByUserId(userId);
        const hasAttended = registrations.some(
          (r) => String(r.eventId) === String(eventId) &&
               ['REGISTERED', 'CHECKED_IN'].includes(r.status)
        );
        if (!hasAttended) {
          throw AppError.forbidden('You must be registered for this event to leave a review.');
        }
      }
    }

    return true;
  }

  async upsertMyRating({ userId, userRole, userName, eventId, rating }) {
    await this.ensureReviewEligibility({ userId, userRole, eventId });
    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      throw AppError.badRequest('rating must be between 1 and 5.');
    }

    const profile = await this.resolveAuthorProfile(userId, userName);

    const ratingEntry = await this.reviewRepo.upsertUserRating({
      userId,
      userName: profile.userName,
      userAvatarUrl: profile.userAvatarUrl,
      eventId: String(eventId),
      rating: parsedRating,
    });

    await this.syncRatingToSpring(eventId);
    return ratingEntry;
  }

  async createComment({ userId, userRole, userName, eventId, comment }) {
    await this.ensureReviewEligibility({ userId, userRole, eventId });

    const commentText = String(comment || '').trim();
    if (!commentText) {
      throw AppError.badRequest('comment is required.');
    }

    const profile = await this.resolveAuthorProfile(userId, userName);

    return this.reviewRepo.create({
      userId,
      userName: profile.userName,
      userAvatarUrl: profile.userAvatarUrl,
      eventId: String(eventId),
      comment: commentText,
    });
  }

  async createReview({ userId, userRole, userName, eventId, rating, comment }) {
    const hasRating = rating !== undefined && rating !== null && rating !== '';
    const hasComment = String(comment || '').trim().length > 0;

    if (!hasRating && !hasComment) {
      throw AppError.badRequest('Either rating or comment is required.');
    }

    let ratingEntry = null;
    let commentEntry = null;

    if (hasRating) {
      ratingEntry = await this.upsertMyRating({ userId, userRole, userName, eventId, rating });
    }

    if (hasComment) {
      commentEntry = await this.createComment({ userId, userRole, userName, eventId, comment });
    }

    if (ratingEntry && commentEntry) {
      return { rating: ratingEntry, comment: commentEntry };
    }

    return ratingEntry || commentEntry;
  }

  async _isVendorEventOwner(userId, eventId) {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await this.springClient.get(`/api/events/${eventId}`);
        const eventPayload = response?.data?.data ?? response?.data ?? null;
        const vendorUserId = String(eventPayload?.vendorUserId || '').trim();
        if (!vendorUserId) return false;
        return vendorUserId === String(userId);
      } catch (err) {
        if (err.response?.status === 404) {
          throw AppError.notFound(`Event ${eventId} not found.`);
        }
        lastError = err;
        if (!err.response || attempt === 2) break;
      }
    }

    throw AppError.internal(
      `Could not verify event owner from event service at ${this.springBaseUrl}. ` +
      `Last error: ${lastError?.message ?? 'unknown'}`
    );
  }

  async getReviews(eventId, { page, limit } = {}) {
    return this.reviewRepo.findCommentsByEventId(String(eventId), { page, limit });
  }

  async getMyRating(userId, eventId) {
    return this.reviewRepo.findLatestRatingByUserAndEvent(userId, String(eventId));
  }

  async getRatingSummary(eventId) {
    return this.reviewRepo.calcAvgRatingUniqueUsers(String(eventId));
  }

  async updateReview(reviewId, userId, { comment }) {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) throw AppError.notFound('Review not found.');
    if (review.userId !== userId) throw AppError.forbidden('You can only edit your own reviews.');
    if (review.rating !== undefined && review.rating !== null) {
      throw AppError.badRequest('Rating entries cannot be edited via comment update endpoint.');
    }

    return this.reviewRepo.updateCommentById(reviewId, comment);
  }

  async deleteReview(reviewId, actor) {
    const actorUserId = actor?.userId;
    const actorRole = String(actor?.role || '').toUpperCase();
    const isAdmin = actorRole === 'ADMIN';

    const review = await this.reviewRepo.findById(reviewId);
    if (!review) throw AppError.notFound('Review not found.');
    if (!isAdmin && review.userId !== actorUserId) {
      throw AppError.forbidden('You can only delete your own reviews.');
    }

    await this.reviewRepo.deleteById(reviewId);

    if (review.rating !== undefined && review.rating !== null) {
      await this.syncRatingToSpring(review.eventId);
    }

    return true;
  }

  /** Recalculate average and push to Spring's internal endpoint */
  async syncRatingToSpring(eventId) {
    try {
      if (!this.internalSecret) {
        return;
      }

      const { avgRating } = await this.reviewRepo.calcAvgRatingUniqueUsers(String(eventId));
      await axios.patch(
        `${this.springBaseUrl}/api/internal/events/${eventId}/rating`,
        { avgRating },
        { headers: { 'X-Internal-Secret': this.internalSecret }, timeout: 5000 }
      );
    } catch (err) {
      console.error(`Failed to sync rating for event ${eventId}:`, err.message);
      // Non-critical — the rating will be slightly stale but not lost
    }
  }
}
