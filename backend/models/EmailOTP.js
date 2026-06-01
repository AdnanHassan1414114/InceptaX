/**
 * models/EmailOTP.js
 *
 * Stores hashed 6-digit OTPs for email verification.
 * One record per user — new OTP request invalidates any previous one.
 *
 * Security:
 *   - Raw OTP (6 digits) only ever sent in email, never stored
 *   - SHA-256 hash stored in DB
 *   - TTL: 10 minutes (MongoDB auto-deletes via expireAfterSeconds)
 *   - Max 3 failed attempts before the OTP is invalidated
 */
const mongoose = require('mongoose');

const emailOTPSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true, // one active OTP per user at a time
    },
    // SHA-256 hash of the raw 6-digit OTP
    hashedOtp: {
      type:     String,
      required: true,
    },
    // Failed verification attempts for this OTP
    attempts: {
      type:    Number,
      default: 0,
    },
    // Auto-deleted by MongoDB after expiry
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  },
  { timestamps: true }
);

// TTL index — MongoDB removes document when expiresAt is reached
emailOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Note: userId index is created automatically by unique:true on the field

module.exports = mongoose.model('EmailOTP', emailOTPSchema);