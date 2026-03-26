import { Router } from 'express';
import { ReviewController } from '../controllers/ReviewController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const ctrl = new ReviewController();

// Public — list reviews for an event
router.get('/event/:eventId',      ctrl.getByEvent.bind(ctrl));

// Authenticated — CRUD
router.post('/',                   authenticate, ctrl.create.bind(ctrl));
router.get('/event/:eventId/mine', authenticate, ctrl.getMine.bind(ctrl));
router.put('/:id',                authenticate, ctrl.update.bind(ctrl));
router.delete('/:id',             authenticate, ctrl.remove.bind(ctrl));

export default router;
