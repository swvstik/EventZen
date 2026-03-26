import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
const ctrl = new AuthController();

// All routes here require JWT + ADMIN
router.use(authenticate, requireRole('ADMIN'));

router.get('/',           ctrl.listUsers.bind(ctrl));
router.delete('/:id',     ctrl.deleteUser.bind(ctrl));
router.patch('/:id/role', ctrl.changeRole.bind(ctrl));

export default router;
