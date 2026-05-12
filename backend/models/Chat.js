const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: [true, 'Submission ID is required'],
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
      trim: true,
    },
  },
  { timestamps: true }
);

chatSchema.index({ submissionId: 1, createdAt: 1 });

module.exports = mongoose.model('Chat', chatSchema);
