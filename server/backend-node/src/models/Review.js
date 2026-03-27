import mongoose from 'mongoose';

/**
 * Review
 * Multiple reviews per user per event are allowed. Rating is 1-5 stars with optional comment.
 */
const reviewSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  userName:  { type: String, default: 'Anonymous' },
  eventId:   { type: String, required: true },   // MySQL events.id as string
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, maxlength: 1000, default: '' },
  createdAt: { type: Date,   default: Date.now },
});

// Fast listing of reviews for an event
reviewSchema.index({ eventId: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
