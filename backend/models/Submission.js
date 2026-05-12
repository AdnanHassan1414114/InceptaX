const mongoose = require('mongoose');

const STATUSES = ['pending', 'ai_evaluated', 'admin_reviewed', 'published', 'rejected'];

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment ID is required'],
    },
    repoLink: {
      type: String,
      required: [true, 'Repository link is required'],
      trim: true,
    },
    liveLink: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    teamMembers: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'pending',
    },
    aiScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    adminScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    rank: {
      type: Number,
      default: null,
    },
    aiFeedback: {
      strengths: { type: [String], default: [] },
      weaknesses: { type: [String], default: [] },
      suggestions: { type: [String], default: [] },
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound unique index: one submission per user per assignment
submissionSchema.index({ userId: 1, assignmentId: 1 }, { unique: true });
submissionSchema.index({ assignmentId: 1, finalScore: -1 });
submissionSchema.index({ status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
