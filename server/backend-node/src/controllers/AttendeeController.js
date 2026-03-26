import { RegistrationService } from '../services/RegistrationService.js';
import { PaymentService } from '../services/PaymentService.js';
import AppError from '../utils/AppError.js';

const registrationSvc = new RegistrationService();
const paymentSvc = new PaymentService();

/**
 * AttendeeController
 * HTTP layer only - no business logic here.
 * All logic lives in RegistrationService.
 */
export class AttendeeController {

  /**
   * POST /api/attendees/register
   * JWT. Body: { eventId, tierId }
   * Returns registration with qrDataUri (REGISTERED) or waitlistPosition (WAITLISTED).
   */
  async register(req, res, next) {
    try {
      const { eventId, tierId, quantity } = req.body;
      if (!eventId || !tierId) throw AppError.badRequest('eventId and tierId are required.');

      const paymentAttempt = await paymentSvc.maybeCreateCheckout({
        user: req.user,
        eventId: String(eventId),
        tierId: String(tierId),
        quantity,
        origin: req.get('origin') || process.env.CLIENT_URL,
      });

      if (paymentAttempt.requiresPayment) {
        return res.status(202).json({
          success: true,
          data: {
            requiresPayment: true,
            orderId: paymentAttempt.orderId,
            checkoutId: paymentAttempt.checkoutId,
            checkoutUrl: paymentAttempt.checkoutUrl,
            subtotalMinor: paymentAttempt.subtotalMinor,
            platformFeeMinor: paymentAttempt.platformFeeMinor,
            amountMinor: paymentAttempt.amountMinor,
            currency: paymentAttempt.currency,
          },
        });
      }

      const registrations = await registrationSvc.register(
        req.user.userId,
        req.user.email,
        String(eventId),
        String(tierId),
        quantity
      );

      const payload = {
        requiresPayment: false,
        registrations,
        quantityRequested: Number(quantity || 1),
        quantityProcessed: registrations.length,
      };

      if (registrations.length === 1) {
        payload.registration = registrations[0];
        payload.status = registrations[0].status;
        if (registrations[0].waitlistPosition) {
          payload.waitlistPosition = registrations[0].waitlistPosition;
        }
      }

      res.status(201).json({ success: true, data: payload });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/attendees/:id
   * JWT. Cancel own registration. Auto-promotes waitlist if applicable.
   */
  async cancel(req, res, next) {
    try {
      const result = await registrationSvc.cancelRegistration(req.user.userId, req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/attendees/my
   * JWT. My registrations with QR codes and waitlist positions.
   */
  async getMyRegistrations(req, res, next) {
    try {
      const registrations = await registrationSvc.getMyRegistrations(req.user.userId);
      res.json({ success: true, data: registrations });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/attendees/event/:eventId
    * JWT + VENDOR/ADMIN. All attendees for event.
   * Query: ?status=REGISTERED&page=0&limit=50
   */
  async getEventAttendees(req, res, next) {
    try {
      const { status, page = 0, limit = 50 } = req.query;
      const result = await registrationSvc.getEventAttendees(
        req.params.eventId,
        { status, page: Number(page), limit: Number(limit) },
        req.user
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/attendees/event/:eventId/count
   * Public. Count of REGISTERED attendees per tier.
   * Used for the live seat counter on the event detail page.
   */
  async getAttendeeCounts(req, res, next) {
    try {
      const counts = await registrationSvc.getAttendeeCounts(req.params.eventId);
      res.json({ success: true, data: counts });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/attendees/event/:eventId/waitlist-count
   * Public. Count of WAITLISTED attendees per tier.
   */
  async getWaitlistCounts(req, res, next) {
    try {
      const counts = await registrationSvc.getWaitlistCounts(req.params.eventId);
      res.json({ success: true, data: counts });
    } catch (err) {
      next(err);
    }
  }

  async getAttendeeCountsBulk(req, res, next) {
    try {
      const { eventIds } = req.body || {};
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ message: 'eventIds (array) is required.' });
      }

      const counts = await registrationSvc.getAttendeeCountsForEvents(eventIds, req.user);
      return res.status(200).json({ success: true, data: counts });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /api/attendees/event/:eventId/export
    * JWT + VENDOR/ADMIN. Streams CSV response.
   */
  async exportCsv(req, res, next) {
    try {
      await registrationSvc.exportCsv(req.params.eventId, res, req.user);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/attendees/checkin
    * JWT + VENDOR/ADMIN. Body: { qrToken } -> sets status=CHECKED_IN.
   * 404 if not found, 409 if already checked in.
   */
  async checkIn(req, res, next) {
    try {
      const { qrToken } = req.body;
      if (!qrToken) throw AppError.badRequest('qrToken is required.');
      const registration = await registrationSvc.checkIn(qrToken, req.user);
      res.json({ success: true, data: registration });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/internal/events/:eventId/cancel-registrations
   * Internal only (protected by X-Internal-Secret middleware).
   */
  async cancelEventRegistrationsInternal(req, res, next) {
    try {
      const { eventId } = req.params;
      if (!eventId) throw AppError.badRequest('eventId is required.');

      const result = await registrationSvc.cancelEventRegistrations(eventId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
