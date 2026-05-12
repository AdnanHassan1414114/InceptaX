const express = require('express');
const router = express.Router();
const {
  getStats,
  getUsers,
  updateUserPlan,
  getSubmissions,
  reviewSubmission,
  aiEvaluate,
  emailBlast,
} = require('../controllers/adminController');
const {
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// Stats
router.get('/stats', getStats);

// Users
router.get('/users', getUsers);
router.patch('/users/:id/plan', updateUserPlan);

// Assignments
router.post('/assignments', createAssignment);
router.put('/assignments/:id', updateAssignment);
router.delete('/assignments/:id', deleteAssignment);

// Submissions
router.get('/submissions', getSubmissions);
router.patch('/submissions/:id/review', reviewSubmission);
router.post('/submissions/:id/ai-evaluate', aiEvaluate);

// Email
router.post('/email/blast', emailBlast);

module.exports = router;
