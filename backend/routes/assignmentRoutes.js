const express = require('express');
const router = express.Router();
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Public + optional auth (for plan-based access info)
router.get('/', authMiddleware, getAssignments);
router.get('/:id', authMiddleware, getAssignment);

// Admin only
router.post('/', authMiddleware, adminMiddleware, createAssignment);
router.put('/:id', authMiddleware, adminMiddleware, updateAssignment);
router.delete('/:id', authMiddleware, adminMiddleware, deleteAssignment);

module.exports = router;
