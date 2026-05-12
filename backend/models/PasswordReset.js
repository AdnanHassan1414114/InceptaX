/**
 * models/PasswordReset.js
 *
 * Stores one-time password reset tokens.
 * TTL index auto-deletes expired tokens from MongoDB.
 */
const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    // Hashed token stored in DB — raw token sent to user via email
    token: {
      type:     String,
      required: true,
    },
    // TTL — MongoDB auto-deletes this document after 1 hour
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  },
  { timestamps: true }
);

// Auto-delete after expiry
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast lookup by userId to invalidate old tokens
passwordResetSchema.index({ userId: 1 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);