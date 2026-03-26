import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String, default: null },
  eventId: { type: String, required: true },
  tierId: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'USD' },
  subtotalMinor: { type: Number, default: null, min: 0 },
  platformFeeMinor: { type: Number, default: null, min: 0 },
  amountMinor: { type: Number, required: true, min: 0 },
  idempotencyKey: { type: String, required: true },
  polarCheckoutId: { type: String, default: null },
  polarCheckoutUrl: { type: String, default: null },
  polarOrderId: { type: String, default: null },
  polarStatus: { type: String, default: 'pending' },
  polarInvoiceUrl: { type: String, default: null },
  polarInvoiceGenerated: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED', 'ALLOCATION_FAILED'],
    default: 'PENDING',
  },
  registrations: {
    type: [
      {
        registrationId: { type: String },
        status: { type: String },
      },
    ],
    default: [],
  },
  errorMessage: { type: String, default: null },
  completedAt: { type: Date, default: null },
  rawLastPayload: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, name: 'payment_idempotency_key' });
paymentSchema.index(
  { polarOrderId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { polarOrderId: { $type: 'string' } },
    name: 'payment_order_id',
  }
);
paymentSchema.index(
  { polarCheckoutId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { polarCheckoutId: { $type: 'string' } },
    name: 'payment_checkout_id',
  }
);

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
