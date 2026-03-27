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
   */
  constructor(reviewRepo, registrationRepo) {
    this.reviewRepo = reviewRepo;
    this.registrationRepo = registrationRepo;
    this.springBaseUrl = process.env.SPRING_BASE_URL || process.env.SPRING_SERVICE_URL || 'http://localhost:8082';
    this.internalSecret = process.env.INTERNAL_SERVICE_SECRET;
    this.springClient = axios.create({
      baseURL: this.springBaseUrl,
      timeout: 5000,
    });
  }

  async createReview({ userId, userRole, userName, eventId, rating, comment }) {
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

    const review = await this.reviewRepo.create({
      userId,
      userName: userName || 'Anonymous',
      eventId: String(eventId),
      rating,
      comment: comment || '',
    });

    await this.syncRatingToSpring(eventId);
    return review;
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
    return this.reviewRepo.findByEventId(String(eventId), { page, limit });
  }

  async getMyReview(userId, eventId) {
    return this.reviewRepo.findByUserAndEvent(userId, String(eventId));
  }

  async updateReview(reviewId, userId, { rating, comment }) {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) throw AppError.notFound('Review not found.');
    if (review.userId !== userId) throw AppError.forbidden('You can only edit your own reviews.');

    const next = {
      rating: Number(rating),
      comment: comment || '',
    };
    const updated = await this.reviewRepo.updateById(reviewId, next);
    await this.syncRatingToSpring(review.eventId);
    return updated;
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

    const eventId = review.eventId;
    await this.reviewRepo.deleteById(reviewId);
    await this.syncRatingToSpring(eventId);
    return true;
  }

  /** Recalculate average and push to Spring's internal endpoint */
  async syncRatingToSpring(eventId) {
    try {
      if (!this.internalSecret) {
        return;
      }

      const { avgRating } = await this.reviewRepo.calcAvgRating(String(eventId));
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
