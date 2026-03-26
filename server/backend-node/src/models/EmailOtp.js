import mongoose from 'mongoose';

/**
 * EmailOtp - eventzen_node.emailOtps
 * TTL collection - MongoDB auto-deletes expired docs via the TTL index.
 * One OTP per email at a time. resendOtp deletes the old doc before creating a new one.
 * OTP stored as String to preserve leading zeros (e.g. "048293").
 */
const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true, // fast lookup by email on every verify call
    },
    // HMAC hash of `${email}:${otp}` scoped by TOKEN_HASH_SECRET/JWT_SECRET
    otpHash: {
      type: String,
      required: true,
      index: true,
    },
    // Legacy field kept for safe migration of pre-hash records.
    otp: {
      type: String,
      required: false,
      select: false,
    },
    // TTL index: MongoDB deletes the document when Date.now() >= expiresAt
    // expireAfterSeconds: 0 means "delete exactly at expiresAt, not N seconds after"
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

const EmailOtp = mongoose.model('EmailOtp', emailOtpSchema);
export default EmailOtp;
