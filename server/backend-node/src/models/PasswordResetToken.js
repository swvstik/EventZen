import mongoose from 'mongoose';

/**
 * PasswordResetToken - eventzen_node.passwordResetTokens
 * TTL collection - auto-deleted after 1 hour.
 * Token is a 64-char hex string generated with crypto.randomBytes(32).
 */
const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // HMAC hash of the raw reset token.
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  // Legacy plaintext token field retained for migration compatibility.
  token: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    select: false,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
});

const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
export default PasswordResetToken;
