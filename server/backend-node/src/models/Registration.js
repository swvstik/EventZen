import mongoose from 'mongoose';

/**
 * Registration
 * One doc per attendee-tier slot.
 */
const registrationSchema = new mongoose.Schema({
  userId:           { type: String, required: true },            // users._id as string
  eventId:          { type: String, required: true },            // MySQL events.id as string
  tierId:           { type: String, required: true },            // MySQL ticket_tiers.id as string
  tierName:         { type: String, default: null },
  ticketUnitPrice:  { type: Number, default: null, min: 0 },
  ticketCurrency:   { type: String, default: null },
  quantity:         { type: Number, default: 1, min: 1 },
  status:           {
    type:    String,
    enum:    ['REGISTERED', 'CANCELLED', 'CHECKED_IN', 'WAITLISTED'],
    required: true,
  },
  waitlistPosition: { type: Number, default: null },             // 1-based, null when not waitlisted
  qrToken:          { type: String, default: null }, // crypto.randomUUID()
  qrDataUri:        { type: String, default: null },             // base64 PNG ~3KB
  registeredAt:     { type: Date,   default: Date.now },
});

// -- Indexes --------------------------------------------------------------------

// Fast lookup for capacity checks and waitlist queries
registrationSchema.index({ eventId: 1, tierId: 1, status: 1 });

// Prevent duplicate waitlist positions per event+tier for active waitlist entries.
registrationSchema.index(
  { eventId: 1, tierId: 1, waitlistPosition: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'WAITLISTED',
      waitlistPosition: { $exists: true, $ne: null },
    },
    name: 'unique_waitlist_position',
  }
);

// Fast lookup for "my registrations"
registrationSchema.index({ userId: 1, registeredAt: -1 });

// Unique qrToken only when qrToken is a non-empty string.
registrationSchema.index(
  { qrToken: 1 },
  {
    unique: true,
    partialFilterExpression: { qrToken: { $type: 'string' } },
    name: 'qrToken_1',
  }
);

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
