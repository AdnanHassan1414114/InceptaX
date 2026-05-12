const Chat = require('../models/Chat');
const Submission = require('../models/Submission');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { createNotification } = require('../utils/notificationService'); // 🔹 NEW

// 🔹 Helper — is this user's plan premium (ten_day or monthly and not expired)?
function isPremiumUser(user) {
  const activePlan = user.getActivePlan();
  const name = activePlan.name;
  return name === 'ten_day' || name === 'monthly';
}

// GET /api/chat/:submissionId
exports.getMessages = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;

  const submission = await Submission.findById(submissionId);
  if (!submission) throw new ApiError(404, 'Submission not found');

  const isOwner = submission.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'Access denied');
  }

  if (!isAdmin && !isPremiumUser(req.user)) {
    throw new ApiError(403, 'PREMIUM_REQUIRED');
  }

  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  const [messages, total] = await Promise.all([
    Chat.find({ submissionId })
      .populate('senderId', 'name username profileImage')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Chat.countDocuments({ submissionId }),
  ]);

  res.json(new ApiResponse(200, buildPaginatedResponse(messages, total, page, pageSize)));
});

// POST /api/chat/:submissionId
// 🔹 UPDATED — notify submission owner when admin sends a message
exports.sendMessage = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message cannot be empty');
  }

  const submission = await Submission.findById(submissionId)
    .populate('assignmentId', 'title');
  if (!submission) throw new ApiError(404, 'Submission not found');

  const isOwner = submission.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'Access denied');
  }

  if (!isAdmin && !isPremiumUser(req.user)) {
    throw new ApiError(403, 'PREMIUM_REQUIRED');
  }

  const chat = await Chat.create({
    submissionId,
    senderId: req.user._id,
    message: message.trim(),
  });

  await chat.populate('senderId', 'name username profileImage');

  const io = req.app.get('io');
  if (io) {
    io.to(`submission:${submissionId}`).emit('new_message', chat);
  }

  // 🔹 Notify submission owner when admin replies — fire-and-forget
  // (We skip notifying admin when owner replies — admin handles many submissions)
  if (isAdmin) {
    createNotification(req.app, submission.userId, {
      type:    'new_team_message', // closest available type; add 'new_chat_message' later if needed
      message: `Admin replied on your submission for "${submission.assignmentId?.title || 'a challenge'}"`,
      link:    `/submissions/${submissionId}`,
      metadata: { submissionId },
    });
  }

  res.status(201).json(new ApiResponse(201, { message: chat }, 'Message sent'));
});