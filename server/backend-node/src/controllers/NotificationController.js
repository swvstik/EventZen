import { NotificationService } from '../services/NotificationService.js';
import { addNotificationSubscriber, publishNotificationEvent } from '../services/NotificationStream.js';

const notifSvc = new NotificationService();

/**
 * NotificationController
 * HTTP layer only. Notifications are NEVER created via HTTP -
 * they are always triggered by RegistrationService internally.
 */
export class NotificationController {

  /**
   * GET /api/notifications/stream
   * JWT. Server-sent events endpoint for realtime notification invalidation.
   */
  async stream(req, res, next) {
    try {
      const userId = req.user.userId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const unsubscribe = addNotificationSubscriber(userId, res);
      publishNotificationEvent(userId, 'connected', { userId });

      const heartbeat = setInterval(() => {
        try {
          res.write(`event: heartbeat\n`);
          res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
        } catch {
          // Socket lifecycle handlers handle cleanup.
        }
      }, 25000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/notifications
   * JWT. Query: ?page=0&limit=20
   * Returns { notifications, unreadCount, total, totalPages, page }
   */
  async getMyNotifications(req, res, next) {
    try {
      const { page = 0, limit = 20 } = req.query;
      const result = await notifSvc.getMyNotifications(
        req.user.userId, Number(page), Number(limit)
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/notifications/unread-count
   * JWT. Returns { count: N }
   * Called by the notification bell on a polling interval.
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await notifSvc.getUnreadCount(req.user.userId);
      res.json({ success: true, data: { count } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * JWT. Mark single notification as read.
   */
  async markRead(req, res, next) {
    try {
      const notification = await notifSvc.markRead(req.user.userId, req.params.id);
      res.json({ success: true, data: notification });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * JWT. Mark all of current user's notifications as read.
   * Returns { updated: N }
   */
  async markAllRead(req, res, next) {
    try {
      const updated = await notifSvc.markAllRead(req.user.userId);
      res.json({ success: true, data: { updated } });
    } catch (err) {
      next(err);
    }
  }
}
