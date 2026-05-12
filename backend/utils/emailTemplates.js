/**
 * utils/emailTemplates.js
 *
 * HTML email templates for InceptaX.
 * All templates use inline styles (required for email clients).
 * Design is minimal, dark-friendly, and mobile-responsive.
 */

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

// ── Shared wrapper ────────────────────────────────────────────────────────────
function wrap(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InceptaX</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Logo / header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#ffffff;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;display:inline-block;">
                    <span style="color:#0a0a0a;font-size:12px;font-weight:700;letter-spacing:0.3px;line-height:36px;display:block;">IX</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:16px;font-weight:600;letter-spacing:-0.3px;">InceptaX</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:14px;padding:32px 28px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0;line-height:1.6;">
                © ${new Date().getFullYear()} InceptaX · Building the future, one commit at a time.<br/>
                <a href="${CLIENT_URL()}" style="color:rgba(255,255,255,0.4);text-decoration:none;">Visit InceptaX</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Shared button ─────────────────────────────────────────────────────────────
function btn(label, url) {
  return `
  <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
    <tr>
      <td style="background:#ffffff;border-radius:9px;padding:0;">
        <a href="${url}" style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:600;color:#0a0a0a;text-decoration:none;letter-spacing:-0.2px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const divider = `<hr style="border:none;border-top:0.5px solid rgba(255,255,255,0.1);margin:20px 0;" />`;

// ── Heading ───────────────────────────────────────────────────────────────────
function h1(text) {
  return `<h1 style="font-size:20px;font-weight:600;color:#ffffff;margin:0 0 8px;letter-spacing:-0.4px;">${text}</h1>`;
}

function p(text, muted = false) {
  return `<p style="font-size:14px;color:${muted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.8)'};line-height:1.7;margin:0 0 12px;">${text}</p>`;
}

function statRow(label, value, highlight = false) {
  return `
  <tr>
    <td style="padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.07);">
      <span style="font-size:12px;color:rgba(255,255,255,0.4);">${label}</span>
    </td>
    <td style="padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.07);text-align:right;">
      <span style="font-size:12px;font-weight:600;color:${highlight ? '#4ade80' : '#ffffff'};">${value}</span>
    </td>
  </tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME EMAIL
// ─────────────────────────────────────────────────────────────────────────────
function getWelcomeTemplate(user) {
  return wrap(`
    ${h1(`Welcome to InceptaX, ${user.name?.split(' ')[0]}! 🚀`)}
    ${p('You\'re now part of a community of builders who ship real projects and get ranked for it.')}
    ${divider}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${statRow('Username', `@${user.username}`)}
      ${statRow('Plan', 'Free')}
    </table>
    ${divider}
    ${p('Here\'s what you can do right now:', true)}
    <ul style="color:rgba(255,255,255,0.7);font-size:13px;line-height:2;padding-left:18px;margin:0 0 16px;">
      <li>Browse open challenges</li>
      <li>Submit your GitHub project</li>
      <li>Get AI-powered feedback</li>
      <li>Climb the leaderboard</li>
    </ul>
    ${btn('Start Building →', `${CLIENT_URL()}/challenges`)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSION PUBLISHED
// ─────────────────────────────────────────────────────────────────────────────
function getSubmissionPublishedTemplate(user, submission) {
  const challengeTitle = submission.assignmentId?.title || 'your challenge';
  const challengeId    = submission.assignmentId?._id   || '';

  return wrap(`
    ${h1('Your submission is live! 🎉')}
    ${p(`Great work, ${user.name?.split(' ')[0]}. Your project for <strong style="color:#fff;">${challengeTitle}</strong> has been reviewed and published.`)}
    ${divider}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${statRow('Challenge',   challengeTitle)}
      ${statRow('AI Score',    submission.aiScore    ?? '—')}
      ${statRow('Admin Score', submission.adminScore ?? '—')}
      ${statRow('Final Score', submission.finalScore ?? '—', true)}
      ${submission.rank ? statRow('Rank', `#${submission.rank}`, true) : ''}
    </table>
    ${divider}
    ${submission.adminNotes ? `${p('<strong style="color:#fff;">Admin notes:</strong>')}${p(submission.adminNotes)}` : ''}
    ${btn('View My Submission →', `${CLIENT_URL()}/submissions/${submission._id}`)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSION REJECTED
// ─────────────────────────────────────────────────────────────────────────────
function getSubmissionRejectedTemplate(user, submission) {
  const challengeTitle = submission.assignmentId?.title || 'your challenge';

  return wrap(`
    ${h1('Submission update')}
    ${p(`Hi ${user.name?.split(' ')[0]}, your submission for <strong style="color:#fff;">${challengeTitle}</strong> was not accepted this round.`)}
    ${divider}
    ${submission.adminNotes
      ? `${p('<strong style="color:#fff;">Feedback from the admin team:</strong>')}
         <div style="background:rgba(248,113,113,0.06);border-left:3px solid rgba(248,113,113,0.5);padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
           <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;line-height:1.6;">${submission.adminNotes}</p>
         </div>`
      : p('Please review the challenge requirements and consider resubmitting.', true)}
    ${p('Don\'t give up — every rejected submission is a step closer to a published one.', true)}
    ${btn('Browse More Challenges →', `${CLIENT_URL()}/challenges`)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
function getPaymentConfirmationTemplate(user, { planName, expiresAt, paymentId }) {
  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return wrap(`
    ${h1(`${planName} activated! ✅`)}
    ${p(`Thanks for upgrading, ${user.name?.split(' ')[0]}! Your plan is now active and all premium features are unlocked.`)}
    ${divider}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${statRow('Plan',       planName, true)}
      ${statRow('Expires',    expiry)}
      ${statRow('Payment ID', paymentId || '—')}
      ${statRow('Amount',     planName.includes('Sprint') ? '₹99' : '₹199')}
    </table>
    ${divider}
    ${p('You now have access to:', true)}
    <ul style="color:rgba(255,255,255,0.7);font-size:13px;line-height:2;padding-left:18px;margin:0 0 16px;">
      <li>All premium challenges</li>
      <li>Team collaboration & real-time chat</li>
      <li>Priority evaluation</li>
    </ul>
    ${btn('Explore Premium Challenges →', `${CLIENT_URL()}/challenges`)}
    ${p('Keep this email as your payment receipt.', true)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEADLINE REMINDER
// ─────────────────────────────────────────────────────────────────────────────
function getDeadlineReminderTemplate(recipient, assignment) {
  return wrap(`
    ${h1(`⏰ Deadline in ~${assignment.hoursLeft}h`)}
    ${p(`Hi ${recipient.name?.split(' ')[0]}, the challenge <strong style="color:#fff;">${assignment.title}</strong> is closing soon!`)}
    ${divider}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${statRow('Challenge',   assignment.title)}
      ${statRow('Time left',   `~${assignment.hoursLeft} hours`, true)}
      ${statRow('Deadline',    new Date(assignment.deadline).toLocaleString('en-IN'))}
    </table>
    ${divider}
    ${p('Submit your project before the deadline to be ranked on the leaderboard.', true)}
    ${btn('Submit Now →', `${CLIENT_URL()}/challenges/${assignment._id}`)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN EMAIL BLAST
// ─────────────────────────────────────────────────────────────────────────────
function getEmailBlastTemplate(recipient, blast) {
  return wrap(`
    ${h1(blast.subject)}
    ${p(`Hi ${recipient.name?.split(' ')[0]},`)}
    <div style="font-size:14px;color:rgba(255,255,255,0.8);line-height:1.8;white-space:pre-wrap;">
      ${blast.body.replace(/\n/g, '<br/>')}
    </div>
    ${divider}
    ${btn('Visit InceptaX →', `${CLIENT_URL()}`)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────────────────────────────────────
function getPasswordResetTemplate(user, resetUrl) {
  return wrap(`
    ${h1('Reset your password 🔐')}
    ${p(`Hi ${user.name?.split(' ')[0]}, we received a request to reset your InceptaX password.`)}
    ${divider}
    ${p('Click the button below to set a new password. This link expires in <strong style="color:#fff;">1 hour</strong>.')}
    ${btn('Reset Password →', resetUrl)}
    ${divider}
    ${p('If you didn\'t request a password reset, you can safely ignore this email. Your password will not be changed.', true)}
    <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:12px 0 0;word-break:break-all;">
      Or copy this link: <a href="${resetUrl}" style="color:rgba(255,255,255,0.4);">${resetUrl}</a>
    </p>
  `);
}

module.exports = {
  getWelcomeTemplate,
  getSubmissionPublishedTemplate,
  getSubmissionRejectedTemplate,
  getPaymentConfirmationTemplate,
  getDeadlineReminderTemplate,
  getEmailBlastTemplate,
  getPasswordResetTemplate,
};