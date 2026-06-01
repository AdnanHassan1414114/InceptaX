/**
 * utils/emailService.js
 *
 * Centralized Nodemailer email service for InceptaX.
 * All send functions are fire-and-forget — never throw, never block responses.
 *
 * Install: npm install nodemailer
 *
 * .env:
 *   EMAIL_HOST=smtp.gmail.com
 *   EMAIL_PORT=587
 *   EMAIL_SECURE=false
 *   EMAIL_USER=your@gmail.com
 *   EMAIL_PASS=your_app_password
 *   EMAIL_FROM="InceptaX <your@gmail.com>"
 */

const nodemailer = require('nodemailer');
const {
  getOTPTemplate,
  getWelcomeTemplate,
  getSubmissionPublishedTemplate,
  getSubmissionRejectedTemplate,
  getPaymentConfirmationTemplate,
  getDeadlineReminderTemplate,
  getEmailBlastTemplate,
  getPasswordResetTemplate,
} = require('./emailTemplates');

// ── Lazy transporter ──────────────────────────────────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:              process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:              parseInt(process.env.EMAIL_PORT || '587'),
    secure:            process.env.EMAIL_SECURE === 'true',
    auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
  });
  return _transporter;
}

const FROM = () => process.env.EMAIL_FROM || `"InceptaX" <${process.env.EMAIL_USER}>`;

// ── Core send ─────────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      // In development without SMTP creds, log the email body to the terminal
      // so you can still test flows. In production this should never happen.
      console.warn('[EmailService] ⚠️  EMAIL_USER/EMAIL_PASS not set — printing email to terminal instead');
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📧 TO:      ${to}`);
      console.log(`📌 SUBJECT: ${subject}`);
      console.log(`📄 BODY (text):\n${(text || html).replace(/<[^>]*>/g, '').trim()}`);
      console.log(`${'═'.repeat(60)}\n`);
      return;
    }
    const info = await getTransporter().sendMail({
      from: FROM(), to, subject, html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    console.log(`[EmailService] ✅ Sent "${subject}" to ${to} — ${info.messageId}`);
  } catch (err) {
    // Log the full error so you know exactly why delivery failed
    console.error(`[EmailService] ❌ Failed to send "${subject}" to ${to}:`);
    console.error(`  Code: ${err.code || 'N/A'}  |  Message: ${err.message}`);
    if (err.code === 'EAUTH') {
      console.error('  → Check EMAIL_USER and EMAIL_PASS in your .env file.');
      console.error('  → For Gmail, use an App Password (not your Google account password).');
      console.error('  → Enable 2FA on your Google account, then generate an App Password at https://myaccount.google.com/apppasswords');
    }
  }
}

async function sendBulkEmail(recipients, { subject, getHtml }) {
  if (!recipients?.length) return;
  const BATCH = 10;
  for (let i = 0; i < recipients.length; i += BATCH) {
    await Promise.allSettled(
      recipients.slice(i, i + BATCH).map((r) =>
        sendEmail({ to: r.email, subject, html: getHtml(r) })
      )
    );
    if (i + BATCH < recipients.length) {
      await new Promise((res) => setTimeout(res, 500));
    }
  }
}

// ── Named senders ─────────────────────────────────────────────────────────────

// 🔹 OTP verification email
async function sendOTPEmail(user, otp) {
  await sendEmail({
    to:      user.email,
    subject: `${otp} is your InceptaX verification code`,
    html:    getOTPTemplate(user, otp),
  });
}

async function sendWelcomeEmail(user) {
  await sendEmail({
    to:      user.email,
    subject: '🚀 Welcome to InceptaX!',
    html:    getWelcomeTemplate(user),
  });
}

async function sendSubmissionPublishedEmail(user, submission) {
  await sendEmail({
    to:      user.email,
    subject: `🎉 Your submission is published — Score: ${submission.finalScore}`,
    html:    getSubmissionPublishedTemplate(user, submission),
  });
}

async function sendSubmissionRejectedEmail(user, submission) {
  await sendEmail({
    to:      user.email,
    subject: 'Submission update — InceptaX',
    html:    getSubmissionRejectedTemplate(user, submission),
  });
}

async function sendPaymentConfirmationEmail(user, { planName, expiresAt, paymentId }) {
  await sendEmail({
    to:      user.email,
    subject: `✅ Payment confirmed — ${planName} activated`,
    html:    getPaymentConfirmationTemplate(user, { planName, expiresAt, paymentId }),
  });
}

async function sendDeadlineReminderEmails(recipients, assignment) {
  await sendBulkEmail(recipients, {
    subject: `⏰ ${assignment.title} — deadline in ~${assignment.hoursLeft}h`,
    getHtml: (r) => getDeadlineReminderTemplate(r, assignment),
  });
}

async function sendEmailBlast(recipients, blast) {
  await sendBulkEmail(recipients, {
    subject: blast.subject,
    getHtml: (r) => getEmailBlastTemplate(r, blast),
  });
}

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
  sendOTPEmail,                    // 🔹
  sendWelcomeEmail,
  sendSubmissionPublishedEmail,
  sendSubmissionRejectedEmail,
  sendPaymentConfirmationEmail,
  sendDeadlineReminderEmails,
  sendEmailBlast,
  sendPasswordResetEmail,
};