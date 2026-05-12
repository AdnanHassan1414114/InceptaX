const express  = require('express');
const router   = express.Router();
const passport = require('../config/passportConfig');

const {
  register,
  login,
  logout,
  refresh,
  oauthCallback,
  forgotPassword,  // 🔹 NEW
  resetPassword,   // 🔹 NEW
} = require('../controllers/authController');

// ── Email / password ──────────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login',    login);
router.post('/logout',   logout);
router.post('/refresh',  refresh);

// 🔹 NEW — Password reset flow
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

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