/**
 * routes/submissionRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();

const {
  createSubmission,
  getSubmissionsByAssignment,
  getSubmission,
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

module.exports = router;