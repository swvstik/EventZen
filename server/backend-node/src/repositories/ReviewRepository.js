import Review from '../models/Review.js';

/**
 * ReviewRepository
 * All Mongoose queries for the reviews collection.
 */
export class ReviewRepository {

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

  async findByUserAndEvent(userId, eventId) {
    return Review.findOne({ userId, eventId });
  }

  async deleteById(id) {
    return Review.findByIdAndDelete(id);
  }

  async updateById(id, data) {
    return Review.findByIdAndUpdate(id, data, { new: true, runValidators: true });
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
}
