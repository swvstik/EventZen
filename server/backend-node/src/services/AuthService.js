import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository.js';
import { PasswordResetTokenRepository } from '../repositories/PasswordResetTokenRepository.js';
import { VendorApplicationRepository } from '../repositories/VendorApplicationRepository.js';
import { TokenService } from './TokenService.js';
import { OtpService } from './OtpService.js';
import AppError from '../utils/AppError.js';

/**
 * AuthService
 * All authentication business logic. No HTTP concerns.
 * Methods: register, verifyEmail, resendOtp, login,
 *          refreshToken, logout, forgotPassword, resetPassword,
 *          getMe, updateMe, listUsers, deleteUser, changeRole
 */
export class AuthService {
  constructor() {
    this.userRepo       = new UserRepository();
    this.vendorAppRepo  = new VendorApplicationRepository();
    this.tokenService   = new TokenService();
    this.otpService     = new OtpService();
    this.resetTokenRepo = new PasswordResetTokenRepository();
  }

  async _issueTokenPair(user) {
    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const accessToken  = this.tokenService.signAccessToken(payload);
    const refreshToken = await this.tokenService.createRefreshToken(payload.userId);
    return { accessToken, refreshToken };
  }

  _validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) return;
    const valid = /^\+\d{1,4}\d{10}$/.test(phoneNumber);
    if (!valid) {
      throw AppError.badRequest('Phone number must include country code and a 10-digit local number.');
    }
  }

  _validatePassword(password) {
    const strongPassword =
      typeof password === 'string' &&
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

    if (!strongPassword) {
      throw AppError.badRequest(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      );
    }
  }

  // -- register -------------------------------------------------------------
  async register({ name, email, phoneNumber, password }) {
    this._validatePassword(password);
    this._validatePhoneNumber(phoneNumber);

    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw AppError.conflict('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);

    await this.userRepo.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      passwordHash,
      isEmailVerified: false,
    });

    await this.otpService.generateAndSave(email);

    return { message: 'Account created. A 6-digit verification code has been sent to your email.' };
  }

  // -- verifyEmail -----------------------------------------------------------
  async verifyEmail({ email, otp }) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw AppError.notFound('No account found with this email.');
    if (user.isEmailVerified) throw AppError.badRequest('Email already verified. Please log in.');

    await this.otpService.verify(email, otp); // throws 400 if wrong/expired

    const verifiedUser = await this.userRepo.setEmailVerified(user._id);

    // Fire-and-forget welcome email
    this.otpService.sendRegistrationConfirmationEmail(verifiedUser.email, verifiedUser.name);

    const { accessToken, refreshToken } = await this._issueTokenPair(verifiedUser);
    return { accessToken, refreshToken, user: verifiedUser };
  }

  // -- resendOtp -------------------------------------------------------------
  async resendOtp({ email }) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw AppError.notFound('No account found with this email.');
    if (user.isEmailVerified) throw AppError.badRequest('Email already verified. Please log in.');

    await this.otpService.generateAndSave(email);
    return { message: 'A new verification code has been sent to your email.' };
  }

  // -- login -----------------------------------------------------------------
  async login({ email, password }) {
    const user = await this.userRepo.findByEmailWithPassword(email);
    const invalidCreds = AppError.unauthorized('Invalid email or password.');

    if (!user) throw invalidCreds;

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) throw invalidCreds;

    // PRD Step 7: block login until verified
    if (!user.isEmailVerified) {
      throw AppError.forbidden(
        'Please verify your email before logging in. Check your inbox for the verification code.'
      );
    }

    const safeUser = await this.userRepo.findById(user._id);
    const { accessToken, refreshToken } = await this._issueTokenPair(safeUser);
    return { accessToken, refreshToken, user: safeUser };
  }

  // -- refreshToken ----------------------------------------------------------
  async refreshToken({ refreshToken }) {
    const userId = await this.tokenService.findAndDeleteRefreshToken(refreshToken);
    if (!userId) throw AppError.unauthorized('Refresh token invalid or expired. Please log in again.');

    const user = await this.userRepo.findById(userId);
    if (!user) throw AppError.unauthorized('User not found.');

    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const newAccessToken  = this.tokenService.signAccessToken(payload);
    const newRefreshToken = await this.tokenService.createRefreshToken(userId);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
  }

  // -- logout ----------------------------------------------------------------
  async logout({ refreshToken }) {
    if (refreshToken) await this.tokenService.deleteRefreshToken(refreshToken);
    return { message: 'Logged out successfully.' };
  }

  // -- forgotPassword --------------------------------------------------------
  async forgotPassword({ email }) {
    const always200 = { message: 'If an account with that email exists, a reset link has been sent.' };

    const user = await this.userRepo.findByEmail(email);
    if (!user) return always200; // no enumeration

    const resetToken = await this.resetTokenRepo.create(user._id);
    const clientUrl  = process.env.CLIENT_URL || 'http://localhost:8080';
    const resetUrl   = `${clientUrl}/reset-password?token=${resetToken}`;
    await this.otpService.sendPasswordResetEmail(email, resetUrl);

    return always200;
  }

  // -- resetPassword ---------------------------------------------------------
  async resetPassword({ token, newPassword }) {
    this._validatePassword(newPassword);

    const doc = await this.resetTokenRepo.findByToken(token);

    if (!doc || doc.expiresAt < new Date()) {
      if (doc) await this.resetTokenRepo.deleteByToken(token);
      throw AppError.badRequest('Reset token is invalid or has expired.');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.updateById(doc.userId, { passwordHash: hash });
    await this.resetTokenRepo.deleteByToken(token);
    await this.tokenService.deleteAllRefreshTokensForUser(doc.userId.toString());

    return { message: 'Password reset successfully. Please log in.' };
  }

  // -- getMe / updateMe ------------------------------------------------------
  async getMe(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw AppError.notFound('User not found.');
    return user;
  }

  async updateMe(userId, { name, email, phoneNumber, avatarUrl, avatarObjectName }) {
    const currentUser = await this.userRepo.findById(userId);
    if (!currentUser) throw AppError.notFound('User not found.');

    if (email !== undefined) {
      const normalized = String(email).toLowerCase().trim();
      if (normalized !== currentUser.email) {
        throw AppError.badRequest('Email changes are disabled from this screen.');
      }
    }

    this._validatePhoneNumber(phoneNumber);

    const updates = {};
    if (name)                   updates.name      = name.trim();
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber ? phoneNumber.trim() : null;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (avatarObjectName !== undefined) updates.avatarObjectName = avatarObjectName || null;

    const updated = await this.userRepo.updateById(userId, updates);
    if (!updated) throw AppError.notFound('User not found.');
    return updated;
  }

  async requestEmailChange(userId, { newEmail }) {
    const currentUser = await this.userRepo.findById(userId);
    if (!currentUser) throw AppError.notFound('User not found.');

    const normalized = String(newEmail || '').toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      throw AppError.badRequest('Please provide a valid email address.');
    }

    if (normalized === currentUser.email) {
      throw AppError.badRequest('This is already your current email.');
    }

    const existing = await this.userRepo.findByEmail(normalized);
    if (existing) {
      throw AppError.conflict('An account with this email already exists.');
    }

    await this.otpService.generateAndSave(normalized);
    return {
      message: 'Verification code sent to new email address.',
      pendingEmail: normalized,
    };
  }

  async confirmEmailChange(userId, { newEmail, otp }) {
    const currentUser = await this.userRepo.findById(userId);
    if (!currentUser) throw AppError.notFound('User not found.');

    const normalized = String(newEmail || '').toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      throw AppError.badRequest('Please provide a valid email address.');
    }

    if (normalized === currentUser.email) {
      throw AppError.badRequest('This is already your current email.');
    }

    const existing = await this.userRepo.findByEmail(normalized);
    if (existing) {
      throw AppError.conflict('An account with this email already exists.');
    }

    await this.otpService.verify(normalized, otp);

    const updated = await this.userRepo.updateById(userId, {
      email: normalized,
      isEmailVerified: true,
    });
    if (!updated) throw AppError.notFound('User not found.');

    await this.tokenService.deleteAllRefreshTokensForUser(userId);

    return updated;
  }

  // -- Admin -----------------------------------------------------------------
  async listUsers({ page = 0, limit = 20, q = '' } = {}) {
    return this.userRepo.findAll({
      page: Number(page),
      limit: Number(limit),
      q: String(q || ''),
    });
  }

  async deleteUser(targetId) {
    const user = await this.userRepo.deleteById(targetId);
    if (!user) throw AppError.notFound('User not found.');
    await this.tokenService.deleteAllRefreshTokensForUser(targetId);
    return { message: 'User deleted.' };
  }

  async changeRole(targetId, role) {
    const valid = ['CUSTOMER', 'VENDOR', 'ADMIN'];
    if (!valid.includes(role)) throw AppError.badRequest(`Role must be one of: ${valid.join(', ')}`);
    const user = await this.userRepo.updateRole(targetId, role);
    if (!user) throw AppError.notFound('User not found.');
    return user;
  }

  async getVendorDisplayProfile(userId) {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw AppError.badRequest('userId is required.');
    }

    const user = await this.userRepo.findById(normalizedUserId);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    const approvedApplication = await this.vendorAppRepo.findLatestApprovedByUserId(normalizedUserId);
    const companyName = String(approvedApplication?.businessName || '').trim();
    const userName = String(user?.name || '').trim();
    const displayName = companyName || userName || 'Vendor';

    return {
      userId: normalizedUserId,
      displayName,
      companyName: companyName || null,
      userName: userName || null,
    };
  }
}
