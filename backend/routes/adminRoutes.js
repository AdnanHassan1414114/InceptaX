/**
 * routes/adminRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();

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

const authMiddleware     = require('../middleware/authMiddleware');
const adminMiddleware    = require('../middleware/adminMiddleware');
const validate           = require('../validators/validate');
const adminSchemas       = require('../validators/adminValidators');
const assignmentSchemas  = require('../validators/assignmentValidators');

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// Stats
router.get('/stats', getStats);

// Users
router.get('/users', validate(adminSchemas.listUsers, 'query'), getUsers);
router.patch('/users/:id/plan', validate(adminSchemas.updateUserPlan), updateUserPlan);

// Assignments
router.post('/assignments', validate(assignmentSchemas.createAssignment), createAssignment);
router.put('/assignments/:id', validate(assignmentSchemas.updateAssignment), updateAssignment);
router.delete('/assignments/:id', deleteAssignment);

// Submissions
router.get('/submissions', validate(adminSchemas.listSubmissions, 'query'), getSubmissions);
router.patch('/submissions/:id/review', validate(adminSchemas.reviewSubmission), reviewSubmission);
router.post('/submissions/:id/ai-evaluate', aiEvaluate);

// Email
router.post('/email/blast', validate(adminSchemas.emailBlast), emailBlast);

module.exports = router;