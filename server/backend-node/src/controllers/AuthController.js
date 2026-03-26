import { AuthService } from '../services/AuthService.js';

const REFRESH_COOKIE_NAME = 'ez_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function useSecureCookie() {
  return process.env.COOKIE_SECURE === 'true';
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(),
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useSecureCookie(),
    path: '/api/auth',
  });
}

function getRefreshTokenFromRequest(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || null;
}

/**
 * AuthController
 * HTTP layer only - reads req, calls AuthService, writes res.
 * Zero business logic here.
 */
export class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  async register(req, res, next) {
    try {
      const { name, email, phoneNumber, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'name, email, and password are required.',
        });
      }

      const result = await this.authService.register({ name, email, phoneNumber, password });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async verifyEmail(req, res, next) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: 'email and otp are required.',
        });
      }

      const result = await this.authService.verifyEmail({ email, otp });
      const { refreshToken, ...payload } = result;
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ success: true, data: payload });
    } catch (err) { next(err); }
  }

  async resendOtp(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'email is required.',
        });
      }

      const result = await this.authService.resendOtp({ email });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'email and password are required.',
        });
      }

      const result = await this.authService.login({ email, password });
      const { refreshToken, ...payload } = result;
      setRefreshCookie(res, refreshToken);
      res.status(200).json({ success: true, data: payload });
    } catch (err) { next(err); }
  }

  async refresh(req, res, next) {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'refresh token is required.' });
      }

      const result = await this.authService.refreshToken({ refreshToken });
      const { refreshToken: nextRefreshToken, ...payload } = result;
      setRefreshCookie(res, nextRefreshToken);
      res.status(200).json({ success: true, data: payload });
    } catch (err) { next(err); }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      const result = await this.authService.logout({ refreshToken });
      clearRefreshCookie(res);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'email is required.',
        });
      }

      const result = await this.authService.forgotPassword({ email });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'token and newPassword are required.',
        });
      }

      const result = await this.authService.resetPassword({ token, newPassword });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async getMe(req, res, next) {
    try {
      const user = await this.authService.getMe(req.user.userId);
      res.status(200).json({ success: true, data: user, user });
    } catch (err) { next(err); }
  }

  async updateMe(req, res, next) {
    try {
      const { name, email, phoneNumber, avatarUrl, avatarObjectName } = req.body;

      if (
        typeof name === 'undefined' &&
        typeof email === 'undefined' &&
        typeof phoneNumber === 'undefined' &&
        typeof avatarUrl === 'undefined' &&
        typeof avatarObjectName === 'undefined'
      ) {
        return res.status(400).json({
          success: false,
          message: 'At least one field is required: name, email, phoneNumber, avatarUrl, avatarObjectName.',
        });
      }

      const user = await this.authService.updateMe(req.user.userId, {
        name,
        email,
        phoneNumber,
        avatarUrl,
        avatarObjectName,
      });
      res.status(200).json({ success: true, data: user, user });
    } catch (err) { next(err); }
  }

  async requestEmailChange(req, res, next) {
    try {
      const { newEmail } = req.body;
      if (!newEmail) {
        return res.status(400).json({ success: false, message: 'newEmail is required.' });
      }

      const result = await this.authService.requestEmailChange(req.user.userId, { newEmail });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async confirmEmailChange(req, res, next) {
    try {
      const { newEmail, otp } = req.body;
      if (!newEmail || !otp) {
        return res.status(400).json({ success: false, message: 'newEmail and otp are required.' });
      }

      const user = await this.authService.confirmEmailChange(req.user.userId, { newEmail, otp });
      res.status(200).json({ success: true, data: user, user });
    } catch (err) { next(err); }
  }

  async listUsers(req, res, next) {
    try {
      const { page = 0, limit = 20, q = '' } = req.query;
      const result = await this.authService.listUsers({ page, limit, q });
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async deleteUser(req, res, next) {
    try {
      if (req.params.id === req.user.userId) {
        return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
      }
      const result = await this.authService.deleteUser(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

  async changeRole(req, res, next) {
    try {
      if (req.params.id === req.user.userId) {
        return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
      }
      const { role } = req.body;
      const user = await this.authService.changeRole(req.params.id, role);
      res.status(200).json({ success: true, data: user, user });
    } catch (err) { next(err); }
  }

  async getVendorProfileInternal(req, res, next) {
    try {
      const { userId } = req.params;
      const profile = await this.authService.getVendorDisplayProfile(userId);
      res.status(200).json({ success: true, data: profile });
    } catch (err) { next(err); }
  }
}
