/**
 * routes/assignmentRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();

const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignmentController');

const authMiddleware       = require('../middleware/authMiddleware');
const adminMiddleware      = require('../middleware/adminMiddleware');
const validate             = require('../validators/validate');
const assignmentSchemas    = require('../validators/Assignmentvalidators');

// Public + optional auth
router.get(
  '/',
  authMiddleware,
  validate(assignmentSchemas.listAssignments, 'query'),
  getAssignments
);
router.get('/:id', authMiddleware, getAssignment);

// Admin only
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  validate(assignmentSchemas.createAssignment),
  createAssignment
);
router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  validate(assignmentSchemas.updateAssignment),
  updateAssignment
);
router.delete('/:id', authMiddleware, adminMiddleware, deleteAssignment);

module.exports = router;