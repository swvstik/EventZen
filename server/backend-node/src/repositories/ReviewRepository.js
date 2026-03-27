import Review from '../models/Review.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * ReviewRepository
 * All Mongoose queries for the reviews collection.
 */
export class ReviewRepository {

  async hydrateAvatarUrls(reviews = []) {
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return reviews;
    }

    const idsNeedingLookup = [...new Set(
      reviews
        .filter((review) => !review?.userAvatarUrl && review?.userId)
        .map((review) => String(review.userId))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )];

    if (idsNeedingLookup.length === 0) {
      return reviews;
    }

    const users = await User.find({ _id: { $in: idsNeedingLookup } }).select('_id avatarUrl').lean();
    const avatarsByUserId = new Map(
      users.map((u) => [String(u._id), u.avatarUrl || null])
    );

    return reviews.map((review) => {
      const plain = typeof review?.toObject === 'function' ? review.toObject() : review;
      return {
        ...plain,
        userAvatarUrl: plain?.userAvatarUrl || avatarsByUserId.get(String(plain?.userId)) || null,
      };
    });
  }

  async create(data) {
    return Review.create(data);
  }

  async findByEventId(eventId, { page = 0, limit = 20 } = {}) {
    const skip = page * limit;
    const [reviews, total] = await Promise.all([
      Review.find({ eventId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Review.countDocuments({ eventId }),
    ]);
    return { reviews, total, totalPages: Math.ceil(total / limit), page: Number(page) };
  }

  async findCommentsByEventId(eventId, { page = 0, limit = 20 } = {}) {
    const skip = page * limit;
    const commentFilter = { eventId, comment: { $regex: /\S/ } };
    const [reviews, total] = await Promise.all([
      Review.find(commentFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Review.countDocuments(commentFilter),
    ]);
    const reviewsWithAvatars = await this.hydrateAvatarUrls(reviews);
    return { reviews: reviewsWithAvatars, total, totalPages: Math.ceil(total / limit), page: Number(page) };
  }

  async findLatestRatingByUserAndEvent(userId, eventId) {
    return Review.findOne({ userId, eventId, rating: { $exists: true, $ne: null } })
      .sort({ createdAt: -1 });
  }

  async upsertUserRating({ userId, userName, userAvatarUrl, eventId, rating }) {
    const existing = await this.findLatestRatingByUserAndEvent(userId, eventId);
    if (existing) {
      return Review.findByIdAndUpdate(
        existing._id,
        {
          rating: Number(rating),
          userName: userName || existing.userName || 'Anonymous',
          userAvatarUrl: userAvatarUrl !== undefined ? (userAvatarUrl || null) : existing.userAvatarUrl || null,
        },
        { new: true, runValidators: true }
      );
    }

    return Review.create({
      userId,
      userName: userName || 'Anonymous',
      userAvatarUrl: userAvatarUrl || null,
      eventId,
      rating: Number(rating),
      comment: '',
    });
  }

  async findByUserAndEvent(userId, eventId) {
    return Review.findOne({ userId, eventId });
  }

  async deleteById(id) {
    return Review.findByIdAndDelete(id);
  }

  async updateById(id, data) {
    return Review.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async updateCommentById(id, comment) {
    return Review.findByIdAndUpdate(
      id,
      { comment: String(comment || '') },
      { new: true, runValidators: true }
    );
  }

  async findById(id) {
    return Review.findById(id);
  }

  /** Calculate average rating for an event */
  async calcAvgRating(eventId) {
    const [result] = await Review.aggregate([
      { $match: { eventId } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    return {
      avgRating: result ? Math.round(result.avg * 100) / 100 : 0,
      count: result?.count || 0,
    };
  }

  /**
   * Calculate average rating from latest rating per unique user.
   * Comment-only entries are ignored.
   */
  async calcAvgRatingUniqueUsers(eventId) {
    const [result] = await Review.aggregate([
      { $match: { eventId, rating: { $exists: true, $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$userId', rating: { $first: '$rating' } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    return {
      avgRating: result ? Math.round(result.avg * 100) / 100 : 0,
      count: result?.count || 0,
    };
  }
}
