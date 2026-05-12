const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');

// All notification routes require authentication
router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// Fetch paginated notifications for the current user, newest first.
// Includes unread count in the response for badge display.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const userId = req.user._id;

  const filter = { userId };

  // Optional ?read=false to fetch only unread
  if (req.query.read === 'false') filter.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, read: false }),
  ]);

  res.json(
    new ApiResponse(200, {
      unreadCount,
      ...buildPaginatedResponse(notifications, total, page, pageSize),
    })
  );
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Mark ALL notifications as read for the current user.
// Must be declared before /:id to prevent "read-all" being treated as an id.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, read: false },
    { $set: { read: true } }
  );
  res.json(new ApiResponse(200, null, 'All notifications marked as read'));
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// Mark a single notification as read.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id }, // scoped to owner
    { $set: { read: true } },
    { new: true }
  );

  if (!notification) throw new ApiError(404, 'Notification not found');

  res.json(new ApiResponse(200, { notification }, 'Notification marked as read'));
}));

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// Delete a single notification (owner only).
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!notification) throw new ApiError(404, 'Notification not found');

  res.json(new ApiResponse(200, null, 'Notification deleted'));
}));

module.exports = router;