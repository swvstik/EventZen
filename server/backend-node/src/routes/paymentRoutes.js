import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { PaymentController } from '../controllers/PaymentController.js';

const router = Router();
const controller = new PaymentController();

router.get('/status/:orderId', authenticate, controller.getStatus.bind(controller));
router.post('/status/:orderId/invoice', authenticate, controller.generateInvoice.bind(controller));
router.get('/status/:orderId/invoice', authenticate, controller.getInvoice.bind(controller));
router.post('/webhook/polar', controller.webhook.bind(controller));

export default router;
