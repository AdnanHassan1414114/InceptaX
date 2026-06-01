/**
 * config/redisKeys.js
 *
 * Centralized Redis key builders.
 * All keys are prefixed with "ix:" (InceptaX) to avoid collisions.
 */

const REDIS_KEYS = {
  // ── Auth: Brute force + Rate limiting ────────────────────────────────────
  loginAttempts:    (email)     => `ix:login:attempts:${email.toLowerCase()}`,
  otpResendCount:   (userId)    => `ix:otp:resend:${userId}`,

  // ── Auth: Token blacklist ─────────────────────────────────────────────────
  tokenBlacklist:   (token)     => `ix:token:blacklist:${token}`,

  // ── Auth: Session management (refresh tokens) ─────────────────────────────
  refreshToken:     (userId)    => `ix:session:refresh:${userId}`,

  // ── Auth: OTP storage ─────────────────────────────────────────────────────
  otpData:          (userId)    => `ix:otp:data:${userId}`,

  // ── Auth: Password reset tokens ───────────────────────────────────────────
  passwordReset:    (hashedToken) => `ix:pwd:reset:${hashedToken}`,

  // ── Payment deduplication ─────────────────────────────────────────────────
  webhookProcessed: (paymentId) => `ix:webhook:processed:${paymentId}`,
  paymentVerified:  (paymentId) => `ix:payment:verified:${paymentId}`,

  // ── Leaderboard caching — TTL: 2 minutes ─────────────────────────────────
  globalLeaderboard:     (page, limit)               => `ix:leaderboard:global:${page}:${limit}`,
  assignmentLeaderboard: (assignmentId, page, limit) => `ix:leaderboard:assignment:${assignmentId}:${page}:${limit}`,

  // ── Assignment caching — TTL: 5 minutes ──────────────────────────────────
  assignmentList:    (queryKey) => `ix:assignments:list:${queryKey}`,
  assignmentById:    (id)       => `ix:assignments:one:${id}`,
  assignmentPattern: ()         => `ix:assignments:*`,

  // ── Notification unread count — no TTL (exact counter, mutated on every change) ──
  // Stores the integer unread count for a user as a plain Redis string.
  // Incremented by notificationService on create, decremented/reset on read/delete.
  // Never expires — always reflects the true count. Deleted on mark-all-read.
  notifUnread: (userId) => `ix:notif:unread:${userId}`,
};

module.exports = REDIS_KEYS;