import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const ctrl = new AuthController();

// Public
router.post('/register',        ctrl.register.bind(ctrl));
router.post('/verify-email',    ctrl.verifyEmail.bind(ctrl));
router.post('/resend-otp',      ctrl.resendOtp.bind(ctrl));
router.post('/login',           ctrl.login.bind(ctrl));
router.post('/refresh',         ctrl.refresh.bind(ctrl));
router.post('/forgot-password', ctrl.forgotPassword.bind(ctrl));
router.post('/reset-password',  ctrl.resetPassword.bind(ctrl));

// Semi-protected (refresh cookie/body token)
router.delete('/logout', ctrl.logout.bind(ctrl));

// Protected
router.get('/me',        authenticate, ctrl.getMe.bind(ctrl));
router.put('/me',        authenticate, ctrl.updateMe.bind(ctrl));
router.post('/me/email-change/request', authenticate, ctrl.requestEmailChange.bind(ctrl));
router.post('/me/email-change/confirm', authenticate, ctrl.confirmEmailChange.bind(ctrl));

export default router;
