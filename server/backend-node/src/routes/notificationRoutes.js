import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController.js';
import { authenticate } from '../middleware/auth.js';

const router     = Router();
const controller = new NotificationController();

// All notification routes require authentication
// PATCH /read-all must be registered BEFORE PATCH /:id/read
// otherwise Express matches "read-all" as an :id param
router.get(  '/',               authenticate, controller.getMyNotifications.bind(controller));
router.get(  '/unread-count',   authenticate, controller.getUnreadCount.bind(controller));
router.get(  '/stream',         authenticate, controller.stream.bind(controller));
router.patch('/read-all',       authenticate, controller.markAllRead.bind(controller));
router.patch('/:id/read',       authenticate, controller.markRead.bind(controller));

export default router;
