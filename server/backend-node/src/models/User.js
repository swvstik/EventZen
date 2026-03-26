import mongoose from 'mongoose';

/**
 * User - eventzen_node.users
 * Exact schema from PRD Section 2.5.
 * passwordHash has select:false - never returned unless .select('+passwordHash') is called explicitly.
 * toJSON strips passwordHash as a second safety net.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [2, 'Name must be at least 2 characters'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
      index: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
      match: [/^\+\d{1,4}\d{10}$/, 'Phone number must include country code and a 10-digit local number'],
      default: null,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'VENDOR', 'ADMIN'],
      default: 'CUSTOMER',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarObjectName: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Always strip passwordHash from serialized output
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export default User;
