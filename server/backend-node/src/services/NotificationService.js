import { NotificationRepository } from '../repositories/NotificationRepository.js';
import { sendEmail } from '../utils/mailer.js';
import { registrationTicketEmailHtml, registrationTicketEmailText } from '../utils/emailTemplates.js';
import AppError from '../utils/AppError.js';
import { publishNotificationEvent } from './NotificationStream.js';
import { TicketDocumentService } from './TicketDocumentService.js';

/**
 * NotificationService
 * Creates in-app notifications AND sends Nodemailer emails.
 * Called ONLY by RegistrationService - never directly by a controller.
 *
 * Methods:
 *   createNotification(userId, eventId, type, message)
 *   getMyNotifications(userId, page, limit)
 *   markRead(userId, notificationId)
 *   markAllRead(userId)
 *   getUnreadCount(userId)
 */
export class NotificationService {
  constructor() {
    this.notifRepo = new NotificationRepository();
    this.clientUrl = process.env.CLIENT_URL || 'http://localhost:8080';
  }

  // -- Create (called by RegistrationService) ---------------------------------

  async createNotification(userId, eventId, type, message) {
    const created = await this.notifRepo.create({ userId, eventId, type, message });
    publishNotificationEvent(userId, 'notification', {
      action: 'created',
      notificationId: String(created?._id || created?.id || ''),
      eventId,
      notificationType: type,
    });
    return created;
  }

  // -- Read -------------------------------------------------------------------

  async getMyNotifications(userId, page = 0, limit = 20) {
    return this.notifRepo.findByUserId(userId, { page, limit });
  }

  async getUnreadCount(userId) {
    return this.notifRepo.countUnread(userId);
  }

  // -- Mark read --------------------------------------------------------------

  async markRead(userId, notificationId) {
    const notif = await this.notifRepo.findByIdAndUserId(notificationId, userId);
    if (!notif) throw AppError.notFound('Notification not found.');
    const updated = await this.notifRepo.markRead(notificationId);
    publishNotificationEvent(userId, 'notification', {
      action: 'mark-read',
      notificationId: String(notificationId),
    });
    return updated;
  }

  async markAllRead(userId) {
    const updatedCount = await this.notifRepo.markAllRead(userId);
    publishNotificationEvent(userId, 'notification', {
      action: 'mark-all-read',
      updated: Number(updatedCount || 0),
    });
    return updatedCount;
  }

  // -- Email helpers (called by RegistrationService alongside createNotification) --

  async sendConfirmationEmail(toEmail, event, registrations = []) {
    const safeRegistrations = Array.isArray(registrations) ? registrations : [];
    const ticketPdfBuffer = await TicketDocumentService.buildCombinedPdf({ event, registrations: safeRegistrations });
    const qrAttachments = safeRegistrations
      .filter((entry) => entry?.qrDataUri)
      .map((entry, index) => {
        const ticketId = String(entry?._id || entry?.id || index + 1);
        const base64 = String(entry.qrDataUri).split(',')[1] || '';
        return {
          filename: `eventzen-qr-${ticketId}.png`,
          content: Buffer.from(base64, 'base64'),
          contentType: 'image/png',
        };
      });

    const venueLabel = event?.venue?.name || event?.venueName || event?.ownVenueName || 'Venue details in ticket';
    const emailModel = {
      eventTitle: event?.title || `Event #${event?.id || 'N/A'}`,
      eventDate: event?.eventDate || '',
      venueLabel,
      ticketCount: safeRegistrations.length,
    };

    await sendEmail({
      to:      toEmail,
      subject: 'Your EventZen registration is confirmed!',
      text: registrationTicketEmailText(emailModel),
      html: registrationTicketEmailHtml(emailModel),
      attachments: [
        {
          filename: `eventzen-ticket-${event?.id || 'event'}.pdf`,
          content: ticketPdfBuffer,
          contentType: 'application/pdf',
        },
        ...qrAttachments,
      ],
    });
  }

  async sendWaitlistPromotedEmail(toEmail, eventId) {
    await sendEmail({
      to:      toEmail,
      subject: 'Great news - you got off the waitlist!',
      text:    `A spot opened up! Your waitlist registration for event #${eventId} has been confirmed. Check your dashboard for your QR ticket.`,
      html:    `<h2>You're off the waitlist!</h2>
                <p>A spot opened up for event <strong>#${eventId}</strong>.</p>
                <p>Your registration is now <strong>CONFIRMED</strong>. Open your <a href="${this.clientUrl}/dashboard">dashboard</a> to view your QR ticket.</p>`,
    });
  }
}
