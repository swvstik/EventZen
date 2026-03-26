import Notification from '../models/Notification.js';

/**
 * NotificationRepository
 * All Mongoose queries for the notifications collection.
 */
export class NotificationRepository {

  async create(data) {
    return Notification.create(data);
  }

  // Paginated, newest-first - also returns unread count in one round-trip
  async findByUserId(userId, { page = 0, limit = 20 } = {}) {
    const skip = page * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ sentAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
    ]);
    return {
      notifications,
      total,
      totalPages: Math.ceil(total / limit),
      page:       Number(page),
      unreadCount,
    };
  }

  async findByIdAndUserId(id, userId) {
    return Notification.findOne({ _id: id, userId });
  }

  async markRead(id) {
    return Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
  }

  async markAllRead(userId) {
    const result = await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    return result.modifiedCount;
  }

  async countUnread(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  }
}
