/**
 * utils/emailService.js
 *
 * Centralized Nodemailer email service for InceptaX.
 * All send functions are fire-and-forget — they catch their own errors
 * so an email failure NEVER breaks the calling controller.
 *
 * Install: npm install nodemailer
 *
 * .env keys required:
 *   EMAIL_HOST=smtp.gmail.com          (or smtp.sendgrid.net etc.)
 *   EMAIL_PORT=587
 *   EMAIL_SECURE=false                 (true for port 465)
 *   EMAIL_USER=your@gmail.com
 *   EMAIL_PASS=your_app_password       (Gmail: use App Password, not account password)
 *   EMAIL_FROM="InceptaX <your@gmail.com>"
 *
 * Gmail setup:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Go to myaccount.google.com → Security → App passwords
 *   3. Generate an App Password and use it as EMAIL_PASS
 */

const nodemailer = require('nodemailer');
const { getWelcomeTemplate,
        getSubmissionPublishedTemplate,
        getSubmissionRejectedTemplate,
        getPaymentConfirmationTemplate,
        getDeadlineReminderTemplate,
        getPasswordResetTemplate,
        getEmailBlastTemplate } = require('./emailTemplates');

// ── Lazy transporter — created once on first use ──────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true = TLS on port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Prevent connection timeouts in production
    connectionTimeout: 10000,
    greetingTimeout:   10000,
  });

  return _transporter;
}

const FROM = () => process.env.EMAIL_FROM || `"InceptaX" <${process.env.EMAIL_USER}>`;

// ── Core send function ────────────────────────────────────────────────────────
/**
 * Send a single email. Fire-and-forget — never throws.
 * @param {{ to: string, subject: string, html: string, text?: string }} options
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('[EmailService] EMAIL_USER / EMAIL_PASS not set — skipping email send');
      return;
    }

    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from:    FROM(),
      to,
      subject,
      html,
      text:    text || html.replace(/<[^>]*>/g, ''), // plain text fallback
    });

    console.log(`[EmailService] Sent "${subject}" to ${to} — id: ${info.messageId}`);
  } catch (err) {
    // Never throw — email failure must NOT break any controller
    console.error(`[EmailService] Failed to send "${subject}" to ${to}:`, err.message);
  }
}

/**
 * Send emails to multiple recipients efficiently (one per recipient for personalisation).
 * Batches sends in groups of 10 to avoid overwhelming the SMTP server.
 */
async function sendBulkEmail(recipients, { subject, getHtml }) {
  if (!recipients?.length) return;

  const BATCH = 10;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map((r) =>
        sendEmail({
          to:      r.email,
          subject,
          html:    getHtml(r),
        })
      )
    );
    // Small delay between batches to respect SMTP rate limits
    if (i + BATCH < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

// ── Named email senders ───────────────────────────────────────────────────────

/**
 * Welcome email sent after registration or first OAuth sign-in.
 */
async function sendWelcomeEmail(user) {
  await sendEmail({
    to:      user.email,
    subject: '🚀 Welcome to InceptaX!',
    html:    getWelcomeTemplate(user),
  });
}

/**
 * Notify user their submission has been published with final score.
 */
async function sendSubmissionPublishedEmail(user, submission) {
  await sendEmail({
    to:      user.email,
    subject: `🎉 Your submission is published — Score: ${submission.finalScore}`,
    html:    getSubmissionPublishedTemplate(user, submission),
  });
}

/**
 * Notify user their submission was rejected with admin notes.
 */
async function sendSubmissionRejectedEmail(user, submission) {
  await sendEmail({
    to:      user.email,
    subject: 'Submission update — InceptaX',
    html:    getSubmissionRejectedTemplate(user, submission),
  });
}

/**
 * Payment confirmation after successful Razorpay transaction.
 */
async function sendPaymentConfirmationEmail(user, { planName, expiresAt, paymentId }) {
  await sendEmail({
    to:      user.email,
    subject: `✅ Payment confirmed — ${planName} activated`,
    html:    getPaymentConfirmationTemplate(user, { planName, expiresAt, paymentId }),
  });
}

/**
 * Deadline reminder email (called by cron).
 * @param {Array<{email: string, name: string}>} recipients
 * @param {{ title: string, deadline: Date, hoursLeft: number, challengeLink: string }} assignment
 */
async function sendDeadlineReminderEmails(recipients, assignment) {
  await sendBulkEmail(recipients, {
    subject: `⏰ ${assignment.title} — deadline in ~${assignment.hoursLeft}h`,
    getHtml: (r) => getDeadlineReminderTemplate(r, assignment),
  });
}

/**
 * Admin email blast to all / plan-specific users.
 * @param {Array<{email: string, name: string}>} recipients
 * @param {{ subject: string, body: string }} blast
 */
async function sendEmailBlast(recipients, blast) {
  await sendBulkEmail(recipients, {
    subject: blast.subject,
    getHtml: (r) => getEmailBlastTemplate(r, blast),
  });
}

/**
 * Password reset email with a one-time token link.
 */
async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await sendEmail({
    to:      user.email,
    subject: '🔐 Reset your InceptaX password',
    html:    getPasswordResetTemplate(user, resetUrl),
  });
}

module.exports = {
  sendEmail,
  sendBulkEmail,
  sendWelcomeEmail,
  sendSubmissionPublishedEmail,
  sendSubmissionRejectedEmail,
  sendPaymentConfirmationEmail,
  sendDeadlineReminderEmails,
  sendEmailBlast,
  sendPasswordResetEmail,
};