import Registration from '../models/Registration.js';

/**
 * RegistrationRepository
 * All Mongoose queries for the registrations collection.
 * Zero business logic - that lives in RegistrationService.
 */
export class RegistrationRepository {

  // -- Counts (used for capacity + waitlist position) -------------------------

  async countRegistered(eventId, tierId) {
    const [row] = await Registration.aggregate([
      { $match: { eventId, tierId, status: { $in: ['REGISTERED', 'CHECKED_IN'] } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$quantity', 1] } } } },
    ]);
    return Number(row?.total || 0);
  }

  async countRegisteredForEvent(eventId) {
    const [row] = await Registration.aggregate([
      { $match: { eventId, status: { $in: ['REGISTERED', 'CHECKED_IN'] } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$quantity', 1] } } } },
    ]);
    return Number(row?.total || 0);
  }

  async countWaitlisted(eventId, tierId) {
    return Registration.countDocuments({ eventId, tierId, status: 'WAITLISTED' });
  }

  async countActiveTicketsForUserTier(userId, eventId, tierId) {
    const [row] = await Registration.aggregate([
      {
        $match: {
          userId,
          eventId,
          tierId,
          status: { $in: ['REGISTERED', 'CHECKED_IN', 'WAITLISTED'] },
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$quantity', 1] } } } },
    ]);
    return Number(row?.total || 0);
  }

  // Count REGISTERED per tier for a given event - for the public seat counter
  async countRegisteredPerTier(eventId) {
    return Registration.aggregate([
      { $match: { eventId, status: { $in: ['REGISTERED', 'CHECKED_IN'] } } },
      { $group: { _id: '$tierId', count: { $sum: { $ifNull: ['$quantity', 1] } } } },
      { $project: { tierId: '$_id', count: 1, _id: 0 } },
    ]);
  }

  async countWaitlistedPerTier(eventId) {
    return Registration.aggregate([
      { $match: { eventId, status: 'WAITLISTED' } },
      { $group: { _id: '$tierId', count: { $sum: { $ifNull: ['$quantity', 1] } } } },
      { $project: { tierId: '$_id', count: 1, _id: 0 } },
    ]);
  }

  // Count REGISTERED tickets per event for bulk report views
  async countRegisteredForEvents(eventIds) {
    if (!Array.isArray(eventIds) || eventIds.length === 0) return [];

    return Registration.aggregate([
      { $match: { eventId: { $in: eventIds }, status: { $in: ['REGISTERED', 'CHECKED_IN'] } } },
      {
        $group: {
          _id: { eventId: '$eventId', tierId: '$tierId' },
          count: { $sum: { $ifNull: ['$quantity', 1] } },
        },
      },
      { $project: { eventId: '$_id.eventId', tierId: '$_id.tierId', count: 1, _id: 0 } },
    ]);
  }

  // -- Create -----------------------------------------------------------------

  async create(data) {
    return Registration.create(data);
  }

  // -- Find -------------------------------------------------------------------

  async findById(id) {
    return Registration.findById(id);
  }

  async findByIdAndUserId(id, userId) {
    return Registration.findOne({ _id: id, userId });
  }

  async findByQrToken(qrToken) {
    return Registration.findOne({ qrToken });
  }

  // My registrations - sorted newest first
  async findByUserId(userId) {
    return Registration.find({ userId }).sort({ registeredAt: -1 });
  }

  // All registrations for an event - with optional status filter + pagination
  async findByEventId(eventId, { status, page = 0, limit = 50 } = {}) {
    const filter = { eventId };
    if (status) filter.status = status;
    const skip = page * limit;
    const [registrations, total] = await Promise.all([
      Registration.find(filter).sort({ registeredAt: -1 }).skip(skip).limit(limit),
      Registration.countDocuments(filter),
    ]);
    return { registrations, total, totalPages: Math.ceil(total / limit), page: Number(page) };
  }

  async findActiveByEventId(eventId) {
    return Registration.find({
      eventId,
      status: { $in: ['REGISTERED', 'WAITLISTED'] },
    }).lean();
  }

  async cancelActiveByEventId(eventId) {
    return Registration.updateMany(
      {
        eventId,
        status: { $in: ['REGISTERED', 'WAITLISTED'] },
      },
      {
        $set: {
          status: 'CANCELLED',
          waitlistPosition: null,
        },
        $unset: {
          qrToken: 1,
          qrDataUri: 1,
        },
      }
    );
  }

  // -- Waitlist helpers -------------------------------------------------------

  // The next person to promote - lowest waitlistPosition for this tier
  async findFirstWaitlisted(eventId, tierId) {
    return Registration.findOne({ eventId, tierId, status: 'WAITLISTED' })
      .sort({ waitlistPosition: 1 });
  }

  async findRegisteredByTier(eventId, tierId) {
    return Registration.find({ eventId, tierId, status: 'REGISTERED' })
      .sort({ registeredAt: 1, _id: 1 });
  }

  async findHighestWaitlistPosition(eventId, tierId) {
    const doc = await Registration.findOne({ eventId, tierId, status: 'WAITLISTED' })
      .sort({ waitlistPosition: -1 })
      .select({ waitlistPosition: 1 });

    return Number(doc?.waitlistPosition || 0);
  }

  // Decrement position of everyone behind a cancelled waitlist spot
  async decrementPositionsBehind(eventId, tierId, cancelledPosition) {
    return Registration.updateMany(
      { eventId, tierId, status: 'WAITLISTED', waitlistPosition: { $gt: cancelledPosition } },
      { $inc: { waitlistPosition: -1 } }
    );
  }

  // -- Update -----------------------------------------------------------------

  async updateById(id, data) {
    return Registration.findByIdAndUpdate(id, data, { new: true });
  }

  // -- Export (CSV) -----------------------------------------------------------

  // Returns lean objects for CSV - no full Mongoose docs needed
  async findAllForExport(eventId) {
    return Registration.find({ eventId })
      .sort({ registeredAt: 1 })
      .lean();
  }
}
