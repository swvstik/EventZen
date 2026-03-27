import mongoose from 'mongoose';

/**
 * Review
 * A user can keep one rating per event (managed by service upsert) and leave multiple comments.
 * A document may contain rating, comment, or both for backward compatibility.
 */
const reviewSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  userName:  { type: String, default: 'Anonymous' },
  userAvatarUrl: { type: String, default: null },
  eventId:   { type: String, required: true },   // MySQL events.id as string
  rating:    { type: Number, min: 1, max: 5 },
  comment:   { type: String, maxlength: 1000, default: '' },
  createdAt: { type: Date,   default: Date.now },
});

// Fast listing of reviews for an event
reviewSchema.index({ eventId: 1, createdAt: -1 });
// Fast lookup of the latest rating for a user in an event
reviewSchema.index({ userId: 1, eventId: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
