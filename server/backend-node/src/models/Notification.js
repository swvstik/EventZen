import mongoose from 'mongoose';

/**
 * Notification
 * Created internally by NotificationService - never directly via HTTP.
 * Triggered by every RegistrationService state change.
 */
const notificationSchema = new mongoose.Schema({
  userId:  { type: String, required: true },   // who the notification is for
  eventId: { type: String, required: true },   // MySQL events.id as string
  type: {
    type:     String,
    enum:     [
      'REGISTRATION_CONFIRMED',
      'REGISTRATION_CANCELLED',
      'WAITLIST_JOINED',
      'WAITLIST_PROMOTED',
      'EVENT_UPDATE',
      'EVENT_PENDING_APPROVAL',
      'EVENT_APPROVED',
      'EVENT_REJECTED',
      'VENDOR_APPLICATION_SUBMITTED',
      'VENDOR_APPLICATION_APPROVED',
      'VENDOR_APPLICATION_REJECTED',
    ],
    required: true,
  },
  message: { type: String, required: true },   // human-readable
  isRead:  { type: Boolean, default: false },
  sentAt:  { type: Date,    default: Date.now },
});

// -- Indexes --------------------------------------------------------------------

// Fast newest-first pagination per user
notificationSchema.index({ userId: 1, sentAt: -1 });

// Fast unread count per user
notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
