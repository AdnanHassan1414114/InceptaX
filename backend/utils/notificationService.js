/**
 * utils/notificationService.js
 *
 * 🔹 REDIS — unread notification count is now maintained as a Redis counter
 * (INCR / DECR / DEL) instead of running countDocuments({ read: false }) on
 * every GET /api/notifications request.
 *
 * Counter key:  ix:notif:unread:<userId>   (no TTL — exact, always live)
 *
 * Rules:
 *   createNotification      → INCR by 1
 *   createBulkNotifications → INCR by N (one INCRBY per user)
 *   markAsRead (single)     → DECR by 1 (floor at 0 via getAndClamp)
 *   markAllAsRead           → DEL key (reset to 0)
 *   deleteNotification      → DECR by 1 if the deleted notification was unread
 *
 * Failure policy:
 *   All Redis counter operations are wrapped in try/catch and are non-fatal.
 *   If Redis is unavailable, the HTTP response still succeeds — the counter
 *   just falls back to a MongoDB countDocuments query on the next GET.
 */

const Notification   = require('../models/Notification');
const getRedisClient = require('../config/redisClient');
const REDIS_KEYS     = require('../config/redisKeys');

// Hard cap: if a user exceeds this many notifications, oldest are deleted
const MAX_NOTIFICATIONS_PER_USER = 100;

// ── Redis counter helpers ─────────────────────────────────────────────────────

/**
 * Increment the unread counter for a user by `amount` (default 1).
 * Uses INCRBY so bulk creates are a single Redis call.
 */
async function incrUnread(userId, amount = 1) {
  try {
    const redis = getRedisClient();
    await redis.incrby(REDIS_KEYS.notifUnread(userId.toString()), amount);
  } catch (err) {
    console.error('[NotificationService] incrUnread error:', err.message);
  }
}

/**
 * Decrement the unread counter by 1, floored at 0.
 * Uses a Lua script so the clamp is atomic — no race condition where
 * concurrent decrements could push the counter below zero.
 */
async function decrUnread(userId) {
  try {
    const redis = getRedisClient();
    const key   = REDIS_KEYS.notifUnread(userId.toString());
    // Atomic: get current value, decrement only if > 0
    const lua = `
      local v = redis.call('GET', KEYS[1])
      if not v then return 0 end
      local n = tonumber(v)
      if n <= 0 then return 0 end
      return redis.call('DECRBY', KEYS[1], 1)
    `;
    await redis.eval(lua, 1, key);
  } catch (err) {
    console.error('[NotificationService] decrUnread error:', err.message);
  }
}

/**
 * Reset unread counter to 0 by deleting the key.
 * Next GET /api/notifications will re-seed from MongoDB if needed.
 */
async function resetUnread(userId) {
  try {
    const redis = getRedisClient();
    await redis.del(REDIS_KEYS.notifUnread(userId.toString()));
  } catch (err) {
    console.error('[NotificationService] resetUnread error:', err.message);
  }
}

/**
 * Get the cached unread count.
 * Returns the cached integer if the key exists, or null on miss/error.
 * The route handler falls back to MongoDB countDocuments on null.
 */
async function getCachedUnread(userId) {
  try {
    const redis = getRedisClient();
    const raw   = await redis.get(REDIS_KEYS.notifUnread(userId.toString()));
    return raw !== null ? Math.max(0, parseInt(raw, 10)) : null;
  } catch (err) {
    console.error('[NotificationService] getCachedUnread error:', err.message);
    return null;
  }
}

// ── Socket helpers ────────────────────────────────────────────────────────────

function getIO(app) {
  try { return app?.get('io') || null; } catch { return null; }
}

function emitToUser(io, userId, notification) {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit('notification', {
      id:        notification._id,
      type:      notification.type,
      message:   notification.message,
      link:      notification.link,
      read:      notification.read,
      metadata:  notification.metadata,
      createdAt: notification.createdAt,
    });
  } catch (err) {
    console.error('[NotificationService] Socket emit error:', err.message);
  }
}

// ── Cap enforcement ───────────────────────────────────────────────────────────

async function enforceCapForUser(userId) {
  try {
    const count = await Notification.countDocuments({ userId });
    if (count > MAX_NOTIFICATIONS_PER_USER) {
      const overflow = count - MAX_NOTIFICATIONS_PER_USER;
      const oldest   = await Notification.find({ userId })
        .sort({ createdAt: 1 })
        .limit(overflow)
        .select('_id');
      await Notification.deleteMany({ _id: { $in: oldest.map((n) => n._id) } });
    }
  } catch (err) {
    console.error('[NotificationService] Cap enforcement error:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a single notification for one user.
 * 🔹 Increments Redis unread counter by 1 after DB insert.
 */
async function createNotification(app, userId, data) {
  try {
    const notification = await Notification.create({
      userId,
      type:     data.type,
      message:  data.message,
      link:     data.link     || '',
      metadata: data.metadata || {},
    });

    // 🔹 Increment Redis counter
    await incrUnread(userId);

    // Real-time socket push
    const io = getIO(app);
    emitToUser(io, userId, notification);

    enforceCapForUser(userId).catch(() => {});

    return notification;
  } catch (err) {
    console.error('[NotificationService] createNotification error:', err.message);
    return null;
  }
}

/**
 * Create notifications for multiple users at once (bulk insert).
 * 🔹 Increments each user's Redis counter by 1 via INCRBY.
 */
async function createBulkNotifications(app, userIds, data) {
  if (!userIds || userIds.length === 0) return;

  const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];

  try {
    const docs = uniqueIds.map((userId) => ({
      userId,
      type:     data.type,
      message:  data.message,
      link:     data.link     || '',
      metadata: data.metadata || {},
      read:     false,
    }));

    const inserted = await Notification.insertMany(docs, { ordered: false });

    // 🔹 Increment each user's Redis counter (fire-and-forget, non-fatal)
    // Each user gets exactly 1 new unread notification from this bulk insert.
    uniqueIds.forEach((userId) => incrUnread(userId, 1).catch(() => {}));

    // Real-time socket push
    const io = getIO(app);
    if (io) {
      inserted.forEach((notification) => {
        emitToUser(io, notification.userId, notification);
      });
    }

    uniqueIds.forEach((userId) => {
      enforceCapForUser(userId).catch(() => {});
    });
  } catch (err) {
    console.error('[NotificationService] createBulkNotifications error:', err.message);
  }
}

// Export helpers so notificationRoutes can use them directly
module.exports = {
  createNotification,
  createBulkNotifications,
  // 🔹 exported for use in notificationRoutes.js
  getCachedUnread,
  decrUnread,
  resetUnread,
};