const express = require('express');
const router = express.Router();
const {
  createSubmission,
  getSubmissionsByAssignment,
  getSubmission,
} = require('../controllers/submissionController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createSubmission);
router.get('/assignment/:id', authMiddleware, getSubmissionsByAssignment);
router.get('/:id', authMiddleware, getSubmission);

module.exports = router;
