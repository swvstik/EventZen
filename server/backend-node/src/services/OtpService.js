import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import EmailOtp from '../models/EmailOtp.js';
import AppError from '../utils/AppError.js';
import { hashScopedValue, timingSafeEqualHex, timingSafeEqualString } from '../utils/secretHash.js';
import {
  otpEmailHtml, otpEmailText,
  passwordResetEmailHtml, passwordResetEmailText,
  welcomeEmailHtml, welcomeEmailText,
} from '../utils/emailTemplates.js';

/**
 * OtpService
 * Owns all OTP logic and email sending.
 * Email templates live in src/utils/emailTemplates.js.
 */
export class OtpService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  _generate() {
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  }

  // -- Core OTP -------------------------------------------------------------

  async generateAndSave(email) {
    const normalised = email.toLowerCase().trim();
    await EmailOtp.deleteMany({ email: normalised });

    const otp       = this._generate();
    const otpHash   = hashScopedValue(`${normalised}:${otp}`, 'email-otp');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await EmailOtp.create({ email: normalised, otpHash, expiresAt });

      // Optional local-only OTP logging for manual development testing.
      if (process.env.NODE_ENV !== 'production' && process.env.LOG_OTP_IN_DEV === 'true') {
        console.log(`\nOTP for ${email}: ${otp}\n`);
      }

      await this.sendOtpEmail(normalised, otp);
      return otp;
    } catch (err) {
      await EmailOtp.deleteMany({ email: normalised });
      if (err instanceof AppError) throw err;
      throw AppError.serviceUnavailable('Unable to send verification email right now. Please try again shortly.');
    }
  }

  async verify(email, otp) {
    const normalised = email.toLowerCase().trim();
    const doc = await EmailOtp.findOne({ email: normalised });

    if (!doc) throw AppError.badRequest('OTP expired or invalid. Please request a new one.');

    if (doc.expiresAt < new Date()) {
      await EmailOtp.deleteMany({ email: normalised });
      throw AppError.badRequest('OTP expired. Please request a new one.');
    }

    const expectedHash = hashScopedValue(`${normalised}:${String(otp)}`, 'email-otp');
    const isHashedMatch = timingSafeEqualHex(doc.otpHash, expectedHash);
    const isLegacyMatch = doc.otp ? timingSafeEqualString(doc.otp, String(otp)) : false;

    if (!isHashedMatch && !isLegacyMatch) {
      throw AppError.badRequest('OTP is incorrect.');
    }

    await EmailOtp.deleteMany({ email: normalised });
    return true;
  }

  async deleteForEmail(email) {
    return EmailOtp.deleteMany({ email: email.toLowerCase().trim() });
  }

  // -- Email sending ---------------------------------------------------------

  async sendOtpEmail(email, otp) {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.transporter.sendMail({
        from:    `"EventZen" <${process.env.SMTP_USER}>`,
        to:      email,
        subject: 'Your EventZen verification code',
        text:    otpEmailText(otp, email),
        html:    otpEmailHtml(otp, email),
      });
    } catch (err) {
      console.error('Failed to send OTP email:', err.message);
      throw AppError.serviceUnavailable('Unable to send verification email right now. Please try again shortly.');
    }
  }

  async sendPasswordResetEmail(email, resetUrl) {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.transporter.sendMail({
        from:    `"EventZen" <${process.env.SMTP_USER}>`,
        to:      email,
        subject: 'Reset your EventZen password',
        text:    passwordResetEmailText(resetUrl),
        html:    passwordResetEmailHtml(resetUrl),
      });
    } catch (err) {
      console.error('Failed to send password reset email:', err.message);
    }
  }

  async sendRegistrationConfirmationEmail(email, name) {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.transporter.sendMail({
        from:    `"EventZen" <${process.env.SMTP_USER}>`,
        to:      email,
        subject: 'Welcome to EventZen!',
        text:    welcomeEmailText(name),
        html:    welcomeEmailHtml(name),
      });
    } catch (err) {
      console.error('Failed to send welcome email:', err.message);
    }
  }
}
