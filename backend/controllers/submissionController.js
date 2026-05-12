const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { PLAN_HIERARCHY } = require('../middleware/planGuard');
const { createNotification } = require('../utils/notificationService'); // 🔹 NEW

// POST /api/submissions
exports.createSubmission = asyncHandler(async (req, res) => {
  const { assignmentId, repoLink, liveLink, description, teamMembers } = req.body;

  if (!assignmentId || !repoLink) {
    throw new ApiError(400, 'assignmentId and repoLink are required');
  }

  const assignment = await Assignment.findOne({ _id: assignmentId, isActive: true });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  if (new Date() > new Date(assignment.deadline)) {
    throw new ApiError(400, 'Submission deadline has passed');
  }

  const userPlan = req.user.getActivePlan();
  const userPlanName = userPlan?.name ?? userPlan;
  if (PLAN_HIERARCHY[userPlanName] < PLAN_HIERARCHY[assignment.requiredPlan]) {
    throw new ApiError(403, `This challenge requires a ${assignment.requiredPlan} plan or higher`);
  }

  const existing = await Submission.findOne({ userId: req.user._id, assignmentId });
  if (existing) throw new ApiError(409, 'You have already submitted for this challenge');

  const submission = await Submission.create({
    userId: req.user._id,
    assignmentId,
    repoLink,
    liveLink: liveLink || '',
    description: description || '',
    teamMembers: teamMembers || [],
  });

  await submission.populate([
    { path: 'userId', select: 'name username profileImage' },
    { path: 'assignmentId', select: 'title difficulty' },
  ]);

  res.status(201).json(new ApiResponse(201, { submission }, 'Submission created successfully'));
});

// GET /api/submissions/assignment/:id
exports.getSubmissionsByAssignment = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const { status } = req.query;

  const filter = { assignmentId: req.params.id };

  if (req.user?.role !== 'admin') {
    filter.status = 'published';
  } else if (status) {
    filter.status = status;
  }

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('userId', 'name username profileImage')
      .sort({ finalScore: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, buildPaginatedResponse(submissions, total, page, pageSize)));
});

// GET /api/submissions/:id
exports.getSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('userId', 'name username profileImage')
    .populate('assignmentId', 'title difficulty tags deadline');

  if (!submission) throw new ApiError(404, 'Submission not found');

  const isOwner = req.user && submission.userId._id.toString() === req.user._id.toString();
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && !isOwner && submission.status !== 'published') {
    throw new ApiError(403, 'Access denied');
  }

  res.json(new ApiResponse(200, { submission }));
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 NEW — notifySubmissionPublished
// Called by adminController.reviewSubmission after status → "published".
// Exported so adminController can import it directly.
// ─────────────────────────────────────────────────────────────────────────────
exports.notifySubmissionPublished = async (app, submission) => {
  try {
    // Notify the owner that their submission is published
    await createNotification(app, submission.userId, {
      type:    'submission_published',
      message: `Your submission for "${submission.assignmentId?.title || 'a challenge'}" has been published! 🎉`,
      link:    `/submissions/${submission._id}`,
      metadata: {
        submissionId: submission._id,
        finalScore:   submission.finalScore,
      },
    });

    // If they have a rank, also fire a rank_updated notification
    if (submission.rank !== null && submission.rank !== undefined) {
      await createNotification(app, submission.userId, {
        type:    'rank_updated',
        message: `You are ranked #${submission.rank} for "${submission.assignmentId?.title || 'a challenge'}"`,
        link:    `/leaderboard/challenge/${submission.assignmentId?._id || submission.assignmentId}`,
        metadata: {
          submissionId: submission._id,
          rank:         submission.rank,
          finalScore:   submission.finalScore,
        },
      });
    }
  } catch (err) {
    console.error('[submissionController] notifySubmissionPublished error:', err.message);
  }
};