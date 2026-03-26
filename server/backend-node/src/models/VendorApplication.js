import mongoose from 'mongoose';

const vendorApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    serviceTypes: {
      type: [String],
      default: [],
    },
    portfolioUrl: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
      default: 'PENDING',
      index: true,
    },
    reviewedByUserId: {
      type: String,
      default: null,
    },
    reviewReason: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

vendorApplicationSchema.index({ userId: 1, createdAt: -1 });

// One active pending request per user to avoid race-condition duplicates.
vendorApplicationSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' },
    name: 'unique_pending_vendor_application',
  }
);

const VendorApplication = mongoose.model('VendorApplication', vendorApplicationSchema);
export default VendorApplication;
