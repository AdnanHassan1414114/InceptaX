/**
 * routes/userRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();

const {
  getMe,
  updateProfile,
  getUserByUsername,
  getUserSubmissions,
  getUserStats,
} = require('../controllers/userController');

const authMiddleware = require('../middleware/authMiddleware');
const validate       = require('../validators/validate');
const userSchemas    = require('../validators/Uservalidators');

router.get('/me', authMiddleware, getMe);

router.put(
  '/me/profile',
  authMiddleware,
  validate(userSchemas.updateProfile),       // body
  updateProfile
);

// NOTE: /me routes declared before /:username to avoid shadowing
router.get(
  '/:username',
  authMiddleware,
  validate(userSchemas.usernameParam, 'params'),
  getUserByUsername
);
router.get(
  '/:username/submissions',
  authMiddleware,
  validate(userSchemas.usernameParam, 'params'),
  getUserSubmissions
);
router.get(
  '/:username/stats',
  authMiddleware,
  validate(userSchemas.usernameParam, 'params'),
  getUserStats
);

module.exports = router;