import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { VendorApplicationController } from '../controllers/VendorApplicationController.js';

const router = Router();
const controller = new VendorApplicationController();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', controller.listForAdmin.bind(controller));
router.patch('/:id/status', controller.review.bind(controller));

export default router;
