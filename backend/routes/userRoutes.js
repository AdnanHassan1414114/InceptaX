const express = require('express');
const router = express.Router();
const {
  getMe,
  updateProfile,
  getUserByUsername,
  getUserSubmissions,
  getUserStats,       // 🔹 NEW
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, getMe);
router.put('/me/profile', authMiddleware, updateProfile);

// NOTE: /me routes must be declared before /:username to avoid "me" being
// treated as a username param — already the case, keeping it explicit.
router.get('/:username', authMiddleware, getUserByUsername);
router.get('/:username/submissions', authMiddleware, getUserSubmissions);
router.get('/:username/stats', authMiddleware, getUserStats); // 🔹 NEW

module.exports = router;