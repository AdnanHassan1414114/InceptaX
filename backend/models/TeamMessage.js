// 🔹 NEW FILE - TeamMessage model
// Separate from the existing Chat model (which is scoped to submissionId).
// Keeping them separate avoids any risk of breaking existing submission chat.
const mongoose = require('mongoose');

const teamMessageSchema = new mongoose.Schema(
  {
    // 🔹 Which team this message belongs to
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team ID is required'],
    },

    // 🔹 Who sent the message
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },

    // 🔹 Message body — same limit as existing Chat model
    message: {
      type: String,
      required: [true, 'Message cannot be empty'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
      trim: true,
    },
  },
  { timestamps: true }
);

// 🔹 Compound index: fetch all messages for a team sorted by time (same pattern as Chat.js)
teamMessageSchema.index({ teamId: 1, createdAt: 1 });

module.exports = mongoose.model('TeamMessage', teamMessageSchema);