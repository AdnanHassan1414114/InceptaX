/**
 * routes/submissionRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();
const {
  createSubmission,
  getSubmissionsByAssignment,
  getSubmission,
  getSubmissionStatus,
  retryIndexing,
} = require('../controllers/submissionController');
const authMiddleware      = require('../middleware/authMiddleware');
const validate            = require('../validators/validate');
const submissionSchemas   = require('../validators/submissionValidators');

router.post(
  '/',
  authMiddleware,
  validate(submissionSchemas.createSubmission),
  createSubmission
);
router.get(
  '/assignment/:id',
  authMiddleware,
  validate(submissionSchemas.listByAssignment, 'query'),
  getSubmissionsByAssignment
);
router.get('/:id', authMiddleware, getSubmission);

// 🔹 NEW (step 11) — lightweight status polling endpoint
router.get('/:id/status', authMiddleware, getSubmissionStatus);

// 🔹 NEW (step 12) — retry repo indexing when repoStatus === 'failed'
router.post('/:id/retry-indexing', authMiddleware, retryIndexing);

module.exports = router;