/**
 * routes/notificationRoutes.js
 *
 * 🔹 REDIS — unread count is now served from a Redis counter instead of
 * running Notification.countDocuments({ read: false }) on every request.
 *
 * Counter lifecycle:
 *   GET /              → read from Redis; fall back to MongoDB on cache miss,
 *                        then seed the Redis key for next time
 *   PATCH /:id/read    → decrUnread (atomic Lua, floor 0)
 *   PATCH /read-all    → resetUnread (DEL key)
 *   DELETE /:id        → decrUnread only if the deleted notification was unread
 */

const express      = require('express');
const router       = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Notification   = require('../models/Notification');
const ApiResponse    = require('../utils/ApiResponse');
const ApiError       = require('../utils/ApiError');
const asyncHandler   = require('../utils/asyncHandler');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const {
  getCachedUnread,
  decrUnread,
  resetUnread,
} = require('../utils/notificationService');
const getRedisClient = require('../config/redisClient');
const REDIS_KEYS     = require('../config/redisKeys');

router.use(authMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// 🔹 unreadCount served from Redis counter; falls back to MongoDB on miss.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const userId = req.user._id;
  const filter = { userId };
  if (req.query.read === 'false') filter.read = false;

  // 🔹 Try Redis counter first — avoids a countDocuments query on every poll
  let unreadCount = await getCachedUnread(userId);

  if (unreadCount === null) {
    // Cache miss — query MongoDB and seed the counter for next time
    unreadCount = await Notification.countDocuments({ userId, read: false });

    // Seed Redis key (fire-and-forget) so future requests are fast
    try {
      const redis = getRedisClient();
      // SET only if key doesn't already exist to avoid a race with concurrent creates
      await redis.setnx(REDIS_KEYS.notifUnread(userId.toString()), unreadCount);
    } catch (err) {
      console.error('[notificationRoutes] Redis seed error:', err.message);
    }
  }

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, {
    unreadCount,
    ...buildPaginatedResponse(notifications, total, page, pageSize),
  }));
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// 🔹 DEL unread counter key — resets to 0 atomically.
// Must be declared before /:id to avoid "read-all" being treated as an id.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, read: false },
    { $set: { read: true } }
  );

  // 🔹 Reset Redis counter to 0
  await resetUnread(req.user._id);

  res.json(new ApiResponse(200, null, 'All notifications marked as read'));
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// 🔹 Decrement Redis counter by 1 (atomic Lua, floor 0).
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { read: true } },
    { new: false } // return OLD doc so we know if it was unread before the update
  );

  if (!notification) throw new ApiError(404, 'Notification not found');

  // 🔹 Only decrement if it was actually unread — avoids double-decrement
  // if the client calls this endpoint twice on the same notification.
  if (!notification.read) {
    await decrUnread(req.user._id);
  }

  res.json(new ApiResponse(200, { notification: { ...notification.toObject(), read: true } }, 'Notification marked as read'));
}));

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// 🔹 Decrement Redis counter only if the deleted notification was unread.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id:    req.params.id,
    userId: req.user._id,
  });

  if (!notification) throw new ApiError(404, 'Notification not found');

  // 🔹 Only decrement if the deleted notification was unread
  if (!notification.read) {
    await decrUnread(req.user._id);
  }

  res.json(new ApiResponse(200, null, 'Notification deleted'));
}));

module.exports = router;