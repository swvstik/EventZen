import nodemailer from 'nodemailer';

/**
 * Reusable email sender.
 * Reads SMTP config from environment - same vars used by OtpService.
 * If SMTP vars are not set, logs a warning and skips silently
 * (so the app still works in dev without email configured).
 */
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   587,
    secure: false,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  });

  return _transporter;
}

/**
 * sendEmail({ to, subject, text, html, attachments })
 * Silent no-op if SMTP is not configured (dev convenience).
 */
export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[mailer] SMTP not configured - skipping email to ${to} (${subject})`);
    return;
  }

  try {
    await transporter.sendMail({
      from:    `"EventZen" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
      attachments,
    });
  } catch (err) {
    // Log but don't crash the request - email is fire-and-forget
    console.error(`[mailer] Failed to send email to ${to}:`, err.message);
  }
}
