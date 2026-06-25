const mongoose = require('mongoose');
const STATUSES = ['pending', 'evaluating', 'ai_evaluated', 'admin_reviewed', 'published', 'rejected'];
// Schema for each individual AI provider's evaluation
const aiEvaluationSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['openai', 'claude', 'deepseek', 'gemini', 'groq'],
      required: true,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    strengths:    { type: [String], default: [] },
    weaknesses:   { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    issues:       { type: [String], default: [] },
  },
  { _id: false } // no separate _id for each evaluation
);
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
    // ── AI Evaluation ─────────────────────────────────────────────────────
    // Individual evaluations from each AI provider
    // Premium users see all of these, free users only see finalScore
    aiEvaluations: {
      type: [aiEvaluationSchema],
      default: [],
    },
    // kept for backward compatibility with existing frontend
    aiFeedback: {
      strengths:   { type: [String], default: [] },
      weaknesses:  { type: [String], default: [] },
      suggestions: { type: [String], default: [] },
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
    // tracks if admin manually overrode the AI score
    adminScoreOverride: {
      type:    Boolean,
      default: false,
    },
    adminNotes: {
      type: String,
      default: '',
    },

    // 🔹 NEW — tracks repository processing for the RAG pipeline.
    // 'queued'     -> submission created, processing not started yet
    // 'processing' -> clone/chunk/embed currently running
    // 'ready'      -> chunks are stored, retrieval can be used
    // 'failed'     -> processing errored out; evaluation falls back to
    //                 description-only (same behavior as before this
    //                 feature existed — never blocks evaluation)
    repoStatus: {
      type: String,
      enum: ['queued','processing', 'ready', 'failed'],
      default: 'queued',
    },
  },
  { timestamps: true }
);
// Compound unique index: one submission per user per assignment
submissionSchema.index({ userId: 1, assignmentId: 1 }, { unique: true });
submissionSchema.index({ assignmentId: 1, finalScore: -1 });
submissionSchema.index({ status: 1 });
module.exports = mongoose.model('Submission', submissionSchema);