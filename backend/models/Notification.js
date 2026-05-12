const mongoose = require('mongoose');

// ─── Enum of all notification types ──────────────────────────────────────────
const NOTIFICATION_TYPES = [
  // Team events
  'team_created',
  'join_request_received',
  'member_joined',
  // Chat events
  'new_team_message',
  // Platform events
  'new_challenge',
  'deadline_approaching',
  'submission_published',
  'rank_updated',
];

const notificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },
    // Notification category
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: [true, 'type is required'],
    },
    // Human-readable message shown in the UI
    message: {
      type: String,
      required: [true, 'message is required'],
      maxlength: [500, 'message cannot exceed 500 characters'],
      trim: true,
    },
    // Frontend route to navigate to on click
    link: {
      type: String,
      default: '',
      trim: true,
    },
    // Whether the user has seen this notification
    read: {
      type: Boolean,
      default: false,
    },
    // Optional structured data (e.g. teamId, assignmentId, rank)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Primary query index: fetch all notifications for a user, newest first
notificationSchema.index({ userId: 1, createdAt: -1 });

// Fast unread count queries
notificationSchema.index({ userId: 1, read: 1 });

// TTL index — auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const Notification = mongoose.model('Notification', notificationSchema);
Notification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = Notification;