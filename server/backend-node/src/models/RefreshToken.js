import mongoose from 'mongoose';

/**
 * RefreshToken - eventzen_node.refreshTokens
 * TTL collection. Opaque UUID - not a JWT.
 * Deleted on logout, rotated on every /api/auth/refresh call.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // HMAC hash of the opaque refresh token
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
  },
  { timestamps: true }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
