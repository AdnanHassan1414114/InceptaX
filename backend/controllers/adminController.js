const User       = require('../models/User');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const asyncHandler  = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const ApiResponse   = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { createNotification }       = require('../utils/notificationService');
const { notifySubmissionPublished } = require('./submissionController');
const {
  sendSubmissionPublishedEmail,
  sendSubmissionRejectedEmail,
  sendEmailBlast,
} = require('../utils/emailService'); // 🔹 NEW

// ─── Stats ────────────────────────────────────────────────────────────────────
exports.getStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalAssignments, totalSubmissions, planBreakdown, submissionStatusBreakdown] =
    await Promise.all([
      User.countDocuments({ role: 'user' }),
      Assignment.countDocuments({ isActive: true }),
      Submission.countDocuments(),
      User.aggregate([
        { $match: { role: 'user' } },
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Submission.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

  res.json(new ApiResponse(200, {
    totalUsers, totalAssignments, totalSubmissions,
    planBreakdown, submissionStatusBreakdown,
  }));
});

// ─── Users ────────────────────────────────────────────────────────────────────
exports.getUsers = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const { plan, role, search } = req.query;

  const filter = {};
  if (plan)   filter.plan = plan;
  if (role)   filter.role = role;
  if (search) {
    filter.$or = [
      { name:     { $regex: search, $options: 'i' } },
      { email:    { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, buildPaginatedResponse(
    users.map((u) => u.toPublicJSON()), total, page, pageSize
  )));
});

exports.updateUserPlan = asyncHandler(async (req, res) => {
  const { plan, planExpiresAt } = req.body;
  const validPlans = ['free', 'ten_day', 'monthly'];

  if (!plan || !validPlans.includes(plan)) {
    throw new ApiError(400, `plan must be one of: ${validPlans.join(', ')}`);
  }

  const updates = { plan };
  if (plan === 'ten_day') {
    updates.planExpiresAt = planExpiresAt || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  } else if (plan === 'monthly') {
    updates.planExpiresAt = planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  } else {
    updates.planExpiresAt = null;
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!user) throw new ApiError(404, 'User not found');

  res.json(new ApiResponse(200, { user: user.toPublicJSON() }, 'Plan updated successfully'));
});

// ─── Submissions ──────────────────────────────────────────────────────────────
exports.getSubmissions = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const { status, assignmentId } = req.query;

  const filter = {};
  if (status)       filter.status       = status;
  if (assignmentId) filter.assignmentId = assignmentId;

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('userId',       'name username email')
      .populate('assignmentId', 'title difficulty')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, buildPaginatedResponse(submissions, total, page, pageSize)));
});

// PATCH /api/admin/submissions/:id/review
// 🔹 UPDATED — sends emails on publish and rejection
exports.reviewSubmission = asyncHandler(async (req, res) => {
  const { adminScore, adminNotes, status } = req.body;
  const validStatuses = ['admin_reviewed', 'published', 'rejected'];

  if (status && !validStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
  }
  if (adminScore !== undefined && (adminScore < 0 || adminScore > 100)) {
    throw new ApiError(400, 'adminScore must be between 0 and 100');
  }

  const submission = await Submission.findById(req.params.id);
  if (!submission) throw new ApiError(404, 'Submission not found');

  const previousStatus = submission.status; // 🔹 track status change

  if (adminScore !== undefined) submission.adminScore = adminScore;
  if (adminNotes !== undefined) submission.adminNotes = adminNotes;
  if (status)                   submission.status     = status;

  if (submission.aiScore !== null && submission.adminScore !== null) {
    submission.finalScore = Math.round(submission.aiScore * 0.4 + submission.adminScore * 0.6);
  } else if (submission.adminScore !== null) {
    submission.finalScore = submission.adminScore;
  }

  await submission.save();

  if (submission.status === 'published') {
    await recalculateRanks(submission.assignmentId);
  }

  await submission.populate([
    { path: 'userId',       select: 'name username email' },
    { path: 'assignmentId', select: 'title _id' },
  ]);

  res.json(new ApiResponse(200, { submission }, 'Submission reviewed'));

  // 🔹 Post-response fire-and-forget: notifications + emails
  const submissionOwner = submission.userId;

  if (submission.status === 'published' && previousStatus !== 'published') {
    try {
      const fresh = await Submission.findById(submission._id)
        .populate('assignmentId', 'title _id');
      // Notification
      notifySubmissionPublished(req.app, fresh);
      // 🔹 Email
      sendSubmissionPublishedEmail(submissionOwner, fresh);
    } catch (err) {
      console.error('[adminController] Publish email/notification error:', err.message);
    }
  }

  if (submission.status === 'rejected' && previousStatus !== 'rejected') {
    // 🔹 Email for rejection
    sendSubmissionRejectedEmail(submissionOwner, submission);
  }
});

exports.aiEvaluate = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate(
    'assignmentId', 'title description difficulty'
  );
  if (!submission) throw new ApiError(404, 'Submission not found');

  if (submission.status !== 'pending') {
    throw new ApiError(400, 'Only pending submissions can be AI-evaluated');
  }

  const mockEvaluation = generateMockAIEvaluation(submission);
  submission.aiScore   = mockEvaluation.score;
  submission.aiFeedback = mockEvaluation.feedback;
  submission.status    = 'ai_evaluated';
  await submission.save();

  res.json(new ApiResponse(200, { submission, evaluation: mockEvaluation }, 'AI evaluation complete'));
});

// POST /api/admin/email/blast
// 🔹 UPDATED — sends real emails via nodemailer, replaces console.log mock
exports.emailBlast = asyncHandler(async (req, res) => {
  const { subject, body, targetPlan } = req.body;

  if (!subject || !body) {
    throw new ApiError(400, 'subject and body are required');
  }

  const filter = { role: 'user' };
  if (targetPlan) filter.plan = targetPlan;

  const users = await User.find(filter).select('email name');

  if (users.length === 0) {
    return res.json(new ApiResponse(200, { recipientCount: 0 }, 'No users matched the filter'));
  }

  // Respond immediately — sending happens in background
  res.json(
    new ApiResponse(200, { recipientCount: users.length }, `Email blast queued for ${users.length} users`)
  );

  // 🔹 Send real emails after response — fire-and-forget
  sendEmailBlast(users, { subject, body });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function recalculateRanks(assignmentId) {
  const published = await Submission.find({
    assignmentId,
    status:     'published',
    finalScore: { $ne: null },
  }).sort({ finalScore: -1, createdAt: 1 });

  const bulkOps = published.map((s, idx) => ({
    updateOne: {
      filter: { _id: s._id },
      update: { rank: idx + 1 },
    },
  }));

  if (bulkOps.length) await Submission.bulkWrite(bulkOps);
}

function generateMockAIEvaluation() {
  const score = Math.floor(Math.random() * 41) + 60;
  return {
    score,
    feedback: {
      strengths:   ['Clean project structure', 'Good use of version control', 'Clear documentation'],
      weaknesses:  ['No test coverage detected', 'Error handling could be more comprehensive'],
      suggestions: ['Add unit and integration tests', 'Consider CI/CD pipeline', 'Improve input validation'],
    },
  };
}