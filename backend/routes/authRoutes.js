/**
 * routes/authRoutes.js  — with Zod validation
 */
const express  = require('express');
const router   = express.Router();
const passport = require('../config/passportConfig');

const {
  register,
  verifyEmail,
  resendOTP,
  login,
  logout,
  refresh,
  oauthCallback,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const validate      = require('../validators/validate');
const authSchemas   = require('../validators/authValidators');

// ── Email / password ──────────────────────────────────────────────────────────
router.post('/register',        validate(authSchemas.register),        register);
router.post('/verify-email',    validate(authSchemas.verifyEmail),     verifyEmail);
router.post('/resend-otp',      validate(authSchemas.resendOTP),       resendOTP);
router.post('/login',           validate(authSchemas.login),           login);
router.post('/logout',          logout);
router.post('/refresh',         refresh);
router.post('/forgot-password', validate(authSchemas.forgotPassword),  forgotPassword);
router.post('/reset-password',  validate(authSchemas.resetPassword),   resetPassword);

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get('/google/callback',
  passport.authenticate('google', {
    session:         false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed`,
  }),
  oauthCallback
);

// ── GitHub OAuth ──────────────────────────────────────────────────────────────
router.get('/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);
router.get('/github/callback',
  passport.authenticate('github', {
    session:         false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=github_failed`,
  }),
  oauthCallback
);

module.exports = router;