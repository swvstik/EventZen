import { Router } from 'express';
import { AttendeeController } from '../controllers/AttendeeController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router     = Router();
const controller = new AttendeeController();

// -- Public --------------------------------------------------------------------
// Seat counter - used by event detail page to show seats remaining per tier
router.get('/event/:eventId/count', controller.getAttendeeCounts.bind(controller));
router.get('/event/:eventId/waitlist-count', controller.getWaitlistCounts.bind(controller));

// -- Authenticated (any role) --------------------------------------------------
router.post('/register',           authenticate, controller.register.bind(controller));
router.get('/my',                  authenticate, controller.getMyRegistrations.bind(controller));
router.delete('/:id',              authenticate, controller.cancel.bind(controller));

// -- VENDOR or ADMIN -----------------------------------------------------------
router.get(
  '/event/:eventId',
  authenticate,
  requireRole('VENDOR', 'ADMIN'),
  controller.getEventAttendees.bind(controller)
);
router.get(
  '/event/:eventId/export',
  authenticate,
  requireRole('VENDOR', 'ADMIN'),
  controller.exportCsv.bind(controller)
);
router.post(
  '/events/counts',
  authenticate,
  requireRole('VENDOR', 'ADMIN'),
  controller.getAttendeeCountsBulk.bind(controller)
);
router.post(
  '/checkin',
  authenticate,
  requireRole('VENDOR', 'ADMIN'),
  controller.checkIn.bind(controller)
);

export default router;
