/**
 * emailTemplates.js
 * Neobrutalist email templates with inline styles for broad email client support.
 */

const clientUrl = (path = '') => {
  const base = (process.env.CLIENT_URL || 'http://localhost:8080').replace(/\/$/, '');
  return `${base}${path}`;
};

const shell = (title, label, content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#dff6ff;font-family:'Courier New',Courier,monospace;color:#10243a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:26px 12px;background:#dff6ff;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f8fffe;border:4px solid #10243a;box-shadow:8px 8px 0 #10243a;">
          <tr>
            <td style="padding:16px 20px;background:#87f5d5;border-bottom:4px solid #10243a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;letter-spacing:1px;">EVENTZEN</td>
                  <td align="right" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">${label}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${content}
          <tr>
            <td style="padding:16px 20px;background:#e7fbff;border-top:4px solid #10243a;">
              <p style="margin:0;font-size:12px;line-height:1.5;">
                You received this because you have an EventZen account. If this was not you, ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const brutalButton = (href, label, bg = '#2e7de2', text = '#ffffff') => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
  <tr>
    <td style="background:${bg};border:3px solid #10243a;box-shadow:4px 4px 0 #10243a;">
      <a href="${href}" style="display:inline-block;padding:11px 20px;color:${text};text-decoration:none;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;

export function otpEmailHtml(otp, email) {
  const verifyUrl = `${clientUrl('/verify-email')}?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`;

  return shell(
    'Verify your EventZen email',
    'verify email',
    `
    <tr>
      <td style="padding:22px 20px 10px;">
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.1;text-transform:uppercase;">Confirm your email</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
          Use this one-time code to activate your account. It expires in 10 minutes.
        </p>
        ${brutalButton(verifyUrl, 'Auto-fill code')}
        <div style="border:3px solid #10243a;background:#ffffff;padding:18px 14px;text-align:center;box-shadow:4px 4px 0 #10243a;margin-bottom:16px;">
          <span style="font-size:38px;letter-spacing:10px;font-weight:700;">${otp}</span>
        </div>
        <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-word;">
          If the button does not work, copy this URL:\n${verifyUrl}
        </p>
      </td>
    </tr>
    `
  );
}

export function otpEmailText(otp, email) {
  const verifyUrl = `${clientUrl('/verify-email')}?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`;
  return `EventZen verification code: ${otp}\n\nAuto-fill link: ${verifyUrl}\n\nThis code expires in 10 minutes.`;
}

export function passwordResetEmailHtml(resetUrl) {
  return shell(
    'Reset your EventZen password',
    'password reset',
    `
    <tr>
      <td style="padding:22px 20px 10px;">
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.1;text-transform:uppercase;">Reset password</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;">
          Click the button below to set a new password. This link expires in 1 hour.
        </p>
        ${brutalButton(resetUrl, 'Reset now', '#4bcfa3', '#10243a')}
        <div style="border:3px dashed #10243a;background:#e7fbff;padding:12px;">
          <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-word;">${resetUrl}</p>
        </div>
      </td>
    </tr>
    `
  );
}

export function passwordResetEmailText(resetUrl) {
  return `Reset your EventZen password using this link:\n${resetUrl}\n\nThis link expires in 1 hour.`;
}

export function welcomeEmailHtml(name) {
  const eventsUrl = clientUrl('/events');

  const items = [
    'Register for events with ticket tiers',
    'Use QR check-in at the venue gate',
    'Get reminders and important updates',
    'Track your event activity in one place',
  ];

  return shell(
    'Welcome to EventZen',
    'welcome',
    `
    <tr>
      <td style="padding:22px 20px 10px;">
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.1;text-transform:uppercase;">Welcome, ${name}</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
          Your account is now active. Here is what you can do next:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
          ${items
            .map(
              (item) => `
            <tr>
              <td style="padding:8px 0;border-bottom:2px solid #c7e8ff;font-size:13px;line-height:1.4;">
                <span style="font-weight:700;">[+]</span> ${item}
              </td>
            </tr>`
            )
            .join('')}
        </table>
        ${brutalButton(eventsUrl, 'Browse events', '#2e7de2', '#ffffff')}
      </td>
    </tr>
    `
  );
}

export function welcomeEmailText(name) {
  return `Welcome to EventZen, ${name}!\n\nBrowse events: ${clientUrl('/events')}`;
}

export function registrationTicketEmailHtml({ eventTitle, eventDate, venueLabel, ticketCount }) {
  const dashboardUrl = clientUrl('/dashboard');
  const title = eventTitle || 'Your EventZen event';
  const dateLine = eventDate || 'Date will be shown in your ticket';
  const venueLine = venueLabel || 'Venue details are in your ticket';
  const qty = Number(ticketCount || 0);

  return shell(
    'Your EventZen ticket package',
    'tickets attached',
    `
    <tr>
      <td style="padding:22px 20px 10px;">
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.1;text-transform:uppercase;">Ticket package ready</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
          Your registration is confirmed. We attached your ticket PDF and QR PNG files to this email.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:3px solid #10243a;background:#ffffff;box-shadow:4px 4px 0 #10243a;">
          <tr>
            <td style="padding:10px 12px;border-bottom:2px solid #d3ecff;font-size:12px;"><strong>Event</strong><br/>${title}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:2px solid #d3ecff;font-size:12px;"><strong>Date</strong><br/>${dateLine}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:2px solid #d3ecff;font-size:12px;"><strong>Venue</strong><br/>${venueLine}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-size:12px;"><strong>Tickets</strong><br/>${qty > 0 ? qty : 1}</td>
          </tr>
        </table>

        ${brutalButton(dashboardUrl, 'Open dashboard', '#2e7de2', '#ffffff')}

        <p style="margin:0;font-size:12px;line-height:1.5;">
          At entry, show either the attached QR PNG or the QR inside your PDF ticket.
        </p>
      </td>
    </tr>
    `
  );
}

export function registrationTicketEmailText({ eventTitle, eventDate, venueLabel, ticketCount }) {
  return [
    'Your registration is confirmed.',
    `Event: ${eventTitle || 'EventZen event'}`,
    `Date: ${eventDate || 'See attached ticket PDF'}`,
    `Venue: ${venueLabel || 'See attached ticket PDF'}`,
    `Tickets: ${Number(ticketCount || 0) || 1}`,
    'Attached: ticket PDF + QR PNG file(s).',
    `Dashboard: ${clientUrl('/dashboard')}`,
  ].join('\n');
}
