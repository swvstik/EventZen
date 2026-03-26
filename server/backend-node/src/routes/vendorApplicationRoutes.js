import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { VendorApplicationController } from '../controllers/VendorApplicationController.js';

const router = Router();
const controller = new VendorApplicationController();

router.post('/', authenticate, controller.submit.bind(controller));
router.get('/me', authenticate, controller.getMine.bind(controller));

export default router;
