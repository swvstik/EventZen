import { Router } from 'express';
import { AttendeeController } from '../controllers/AttendeeController.js';
import { AuthController } from '../controllers/AuthController.js';
import { InternalNotificationController } from '../controllers/InternalNotificationController.js';
import { PaymentController } from '../controllers/PaymentController.js';
import { authenticateInternal } from '../middleware/internalAuth.js';

const router = Router();
const attendeeController = new AttendeeController();
const authController = new AuthController();
const internalNotificationController = new InternalNotificationController();
const paymentController = new PaymentController();

// Used by Spring when an event is cancelled.
router.post(
  '/events/:eventId/cancel-registrations',
  authenticateInternal,
  attendeeController.cancelEventRegistrationsInternal.bind(attendeeController)
);

router.post(
  '/payments/platform-fee-aggregates',
  authenticateInternal,
  paymentController.getPlatformFeeAggregatesInternal.bind(paymentController)
);

router.post(
  '/notifications/events/:eventId/pending-approval',
  authenticateInternal,
  internalNotificationController.notifyPendingApproval.bind(internalNotificationController)
);

router.post(
  '/notifications/events/:eventId/status',
  authenticateInternal,
  internalNotificationController.notifyStatusChange.bind(internalNotificationController)
);

router.get(
  '/vendors/:userId/profile',
  authenticateInternal,
  authController.getVendorProfileInternal.bind(authController)
);

export default router;
