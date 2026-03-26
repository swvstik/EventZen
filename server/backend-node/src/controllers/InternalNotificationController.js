import AppError from '../utils/AppError.js';
import { NotificationService } from '../services/NotificationService.js';
import { UserRepository } from '../repositories/UserRepository.js';

const notifSvc = new NotificationService();
const userRepo = new UserRepository();

export class InternalNotificationController {
  async notifyPendingApproval(req, res, next) {
    try {
      const { eventId } = req.params;
      const { eventTitle, vendorUserId } = req.body || {};
      if (!eventId) throw AppError.badRequest('eventId is required.');

      const admins = await userRepo.findByRole('ADMIN');
      await Promise.allSettled(
        (admins || []).map((admin) => notifSvc.createNotification(
          admin._id.toString(),
          String(eventId),
          'EVENT_PENDING_APPROVAL',
          `Event pending approval: ${String(eventTitle || `#${eventId}`)} (vendor: ${String(vendorUserId || 'unknown')}).`
        ))
      );

      res.json({ success: true, data: { deliveredTo: Number((admins || []).length) } });
    } catch (err) {
      next(err);
    }
  }

  async notifyStatusChange(req, res, next) {
    try {
      const { eventId } = req.params;
      const { eventTitle, vendorUserId, status } = req.body || {};
      if (!eventId) throw AppError.badRequest('eventId is required.');
      if (!vendorUserId) throw AppError.badRequest('vendorUserId is required.');

      const normalizedStatus = String(status || '').toUpperCase();
      const approved = normalizedStatus === 'PUBLISHED';
      const type = approved ? 'EVENT_APPROVED' : 'EVENT_REJECTED';
      const message = approved
        ? `Your event ${String(eventTitle || `#${eventId}`)} was approved and is now published.`
        : `Your event ${String(eventTitle || `#${eventId}`)} was sent back for edits.`;

      await notifSvc.createNotification(
        String(vendorUserId),
        String(eventId),
        type,
        message
      );

      res.json({ success: true, data: { type } });
    } catch (err) {
      next(err);
    }
  }
}
