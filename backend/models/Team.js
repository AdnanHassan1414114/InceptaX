const mongoose = require('mongoose');

// 🔹 NEW - Team status options
const TEAM_STATUSES = ['Planning', 'Building', 'Completed'];

const teamSchema = new mongoose.Schema(
  {
    // 🔹 NEW - Team display name
    teamName: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      minlength: [3, 'Team name must be at least 3 characters'],
      maxlength: [60, 'Team name cannot exceed 60 characters'],
    },

    // 🔹 NEW - Which challenge this team is for
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Challenge ID is required'],
    },

    // 🔹 NEW - User who created the team
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },

    // 🔹 NEW - Array of members (includes createdBy on creation)
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // 🔹 NEW - Max allowed members (2–10, default 3 to match existing premium plan limit)
    maxMembers: {
      type: Number,
      default: 3,
      min: [2, 'Team must allow at least 2 members'],
      max: [10, 'Team cannot exceed 10 members'],
    },

    // 🔹 NEW - Optional roles the team is looking for (e.g. ["Frontend", "Backend"])
    requiredRoles: {
      type: [String],
      default: [],
    },

    // 🔹 NEW - Current team status
    status: {
      type: String,
      enum: TEAM_STATUSES,
      default: 'Planning',
    },

    // 🔹 NEW - Pending join requests (users who requested to join)
    joinRequests: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// 🔹 NEW - Index for fast lookup by challenge
teamSchema.index({ challengeId: 1 });

// 🔹 NEW - Index for fast lookup by creator
teamSchema.index({ createdBy: 1 });

// 🔹 NEW - Prevent duplicate teams with the same name for the same challenge
teamSchema.index({ teamName: 1, challengeId: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);