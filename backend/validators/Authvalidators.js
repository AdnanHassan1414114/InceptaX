/**
 * validators/authValidators.js
 *
 * Zod schemas for all /api/auth routes.
 *
 * Regex patterns used:
 *  USERNAME_REGEX  — 3-24 chars, lowercase letters/digits/underscores only
 *  PASSWORD_REGEX  — min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
 *  EMAIL_REGEX     — standard RFC-5322-lite email check (MX check still done in controller)
 *  MONGO_ID_REGEX  — 24-char hex string (MongoDB ObjectId)
 *  OTP_REGEX       — exactly 6 digits
 */

const { z } = require('zod');

// ── Reusable regex constants ──────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;
const OTP_REGEX      = /^\d{6}$/;

// ── Reusable field schemas ────────────────────────────────────────────────────
const emailField = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .regex(EMAIL_REGEX, 'Invalid email address format');

const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(
    PASSWORD_REGEX,
    'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
  );

const mongoIdField = (fieldName = 'id') =>
  z
    .string({ required_error: `${fieldName} is required` })
    .regex(MONGO_ID_REGEX, `${fieldName} must be a valid ID`);

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
const register = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name cannot exceed 60 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),

  email: emailField,

  username: z
    .string({ required_error: 'Username is required' })
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_REGEX,
      'Username must be 3-24 characters and contain only lowercase letters, digits, and underscores'
    ),

  password: passwordField,
});

/**
 * POST /api/auth/verify-email
 */
const verifyEmail = z.object({
  userId: mongoIdField('userId'),
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .regex(OTP_REGEX, 'OTP must be exactly 6 digits'),
});

/**
 * POST /api/auth/resend-otp
 */
const resendOTP = z.object({
  userId: mongoIdField('userId'),
});

/**
 * POST /api/auth/login
 */
const login = z.object({
  email: emailField,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = z.object({
  email: emailField,
});

/**
 * POST /api/auth/reset-password
 */
const resetPassword = z.object({
  token: z
    .string({ required_error: 'Reset token is required' })
    .min(1, 'Reset token is required'),
  password: passwordField,
});

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  // Export shared primitives so other validator files can reuse them
  _shared: { emailField, passwordField, mongoIdField, USERNAME_REGEX, EMAIL_REGEX },
};