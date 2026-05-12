/**
 * notificationService.js
 *
 * Reusable notification utility. Imported by any controller that needs to
 * create notifications. All functions are fire-and-forget — they catch their
 * own errors so a notification failure NEVER breaks the calling controller.
 *
 * Socket emission:
 *   Users join a personal room named `user:<userId>` when they connect.
 *   (Wired in server.js after socket auth.)
 *   We emit the "notification" event to that room.
 */

const Notification = require('../models/Notification');

// Hard cap: if a user exceeds this many notifications, oldest are deleted
const MAX_NOTIFICATIONS_PER_USER = 100;

/**
 * Get the Socket.io instance.
 * We accept `app` (Express app) so callers don't need to import it themselves.
 * Returns null safely if socket isn't set up yet.
 *
 * @param {import('express').Application} app
 * @returns {import('socket.io').Server | null}
 */
function getIO(app) {
  try {
    return app?.get('io') || null;
  } catch {
    return null;
  }
}

/**
 * Emit a real-time notification to a single user's personal socket room.
 *
 * @param {import('socket.io').Server} io
 * @param {string|import('mongoose').ObjectId} userId
 * @param {object} notification - the saved Mongoose document
 */
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

/**
 * Enforce the per-user notification cap.
 * Deletes oldest notifications beyond MAX_NOTIFICATIONS_PER_USER.
 * Called asynchronously — never awaited by the main flow.
 *
 * @param {string|import('mongoose').ObjectId} userId
 */
async function enforceCapForUser(userId) {
  try {
    const count = await Notification.countDocuments({ userId });
    if (count > MAX_NOTIFICATIONS_PER_USER) {
      const overflow = count - MAX_NOTIFICATIONS_PER_USER;
      const oldest = await Notification.find({ userId })
        .sort({ createdAt: 1 })
        .limit(overflow)
        .select('_id');
      const ids = oldest.map((n) => n._id);
      await Notification.deleteMany({ _id: { $in: ids } });
    }
  } catch (err) {
    console.error('[NotificationService] Cap enforcement error:', err.message);
  }
}

/**
 * Create a single notification for one user.
 *
 * @param {import('express').Application} app  - Express app (for socket access)
 * @param {string|import('mongoose').ObjectId} userId
 * @param {{ type: string, message: string, link?: string, metadata?: object }} data
 * @returns {Promise<import('mongoose').Document|null>}
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

    // Real-time push
    const io = getIO(app);
    emitToUser(io, userId, notification);

    // Enforce cap asynchronously (don't block the response)
    enforceCapForUser(userId).catch(() => {});

    return notification;
  } catch (err) {
    console.error('[NotificationService] createNotification error:', err.message);
    return null;
  }
}

/**
 * Create notifications for multiple users at once (bulk insert).
 * Uses insertMany for performance — one DB round-trip regardless of user count.
 *
 * @param {import('express').Application} app
 * @param {Array<string|import('mongoose').ObjectId>} userIds
 * @param {{ type: string, message: string, link?: string, metadata?: object }} data
 * @returns {Promise<void>}
 */
async function createBulkNotifications(app, userIds, data) {
  if (!userIds || userIds.length === 0) return;

  // Deduplicate ids
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

    // Real-time push to each user's personal room
    const io = getIO(app);
    if (io) {
      inserted.forEach((notification) => {
        emitToUser(io, notification.userId, notification);
      });
    }

    // Enforce cap for each user asynchronously
    uniqueIds.forEach((userId) => {
      enforceCapForUser(userId).catch(() => {});
    });
  } catch (err) {
    console.error('[NotificationService] createBulkNotifications error:', err.message);
  }
}

module.exports = { createNotification, createBulkNotifications };