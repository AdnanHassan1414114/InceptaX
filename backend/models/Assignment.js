const mongoose = require('mongoose');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const REQUIRED_PLANS = ['free', 'ten_day', 'monthly'];

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    difficulty: {
      type: String,
      enum: DIFFICULTIES,
      required: [true, 'Difficulty is required'],
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    tags: {
      type: [String],
      default: [],
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    requiredPlan: {
      type: String,
      enum: REQUIRED_PLANS,
      default: 'free',
    },
    prize: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ tags: 1 });
assignmentSchema.index({ difficulty: 1 });
assignmentSchema.index({ isPremium: 1 });
assignmentSchema.index({ deadline: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
