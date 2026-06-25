const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { PLAN_HIERARCHY } = require('../middleware/planGuard');
const { createNotification } = require('../utils/notificationService');
const { processRepository } = require('../utils/repoProcessor');

// ── Helper: strip aiEvaluations for free users ────────────────────────────────
// Free users only see finalScore.
// Premium users see each AI's full breakdown.
function filterSubmissionForUser(submission, user) {
  const obj = submission.toObject ? submission.toObject() : submission;

  const isPremium = user && (
    user.role === 'admin' ||
    PLAN_HIERARCHY[user.getActivePlan().name] >= PLAN_HIERARCHY['ten_day']
  );

  if (!isPremium) {
    // Free user — remove detailed AI evaluations
    delete obj.aiEvaluations;
  }

  return obj;
}

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
    liveLink:    liveLink    || '',
    description: description || '',
    teamMembers: teamMembers || [],
  });

  await submission.populate([
    { path: 'userId',       select: 'name username profileImage' },
    { path: 'assignmentId', select: 'title difficulty' },
  ]);

  res.status(201).json(new ApiResponse(201, { submission }, 'Submission created successfully'));

  // Fire-and-forget repository processing (RAG pipeline).
  // Runs AFTER the response is sent. Cloning + chunking + embedding can
  // take anywhere from a few seconds to ~30s depending on repo size, so
  // it must never block the HTTP response.
  processRepository(submission._id.toString(), repoLink).catch((err) => {
    console.error('[submissionController] processRepository error:', err.message);
  });
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

  // Filter AI details based on plan
  const filtered = submissions.map((s) => filterSubmissionForUser(s, req.user));

  res.json(new ApiResponse(200, buildPaginatedResponse(filtered, total, page, pageSize)));
});

// GET /api/submissions/:id
exports.getSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('userId',       'name username profileImage')
    .populate('assignmentId', 'title difficulty tags deadline');

  if (!submission) throw new ApiError(404, 'Submission not found');

  const isOwner = req.user && submission.userId._id.toString() === req.user._id.toString();
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && !isOwner && submission.status !== 'published') {
    throw new ApiError(403, 'Access denied');
  }

  // Filter AI evaluation details based on user plan
  const filtered = filterSubmissionForUser(submission, req.user);

  res.json(new ApiResponse(200, { submission: filtered }));
});

// GET /api/submissions/:id/status
// 🔹 NEW (step 11) — lightweight polling endpoint so the frontend can
// watch repoStatus + status without fetching the full submission object.
// Used by useSubmissionStatus hook to drive the RepoStatusBadge.
//
// 🔹 FIXED — .select('status repoStatus') was missing 'userId', which
// Mongoose's .select() treats as an INCLUSION list: only the fields
// named are returned (plus _id automatically). Since userId was never
// named, submission.userId was always undefined, which made the
// ownership check below (`submission.userId?.toString() === ...`)
// ALWAYS evaluate to false for every caller — meaning every real user
// got a 403 Access denied on every single poll, and only admins (who
// bypass via isAdmin) could ever successfully call this endpoint.
// This would have made the entire frontend polling feature silently
// non-functional for actual end users while appearing to work fine
// during admin-only testing.
exports.getSubmissionStatus = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .select('status repoStatus userId');
  if (!submission) throw new ApiError(404, 'Submission not found');
  const isOwner = req.user && submission.userId?.toString() === req.user._id.toString();
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && !isOwner) {
    throw new ApiError(403, 'Access denied');
  }
  res.json(new ApiResponse(200, {
    status:     submission.status,
    repoStatus: submission.repoStatus,
  }));
});

// POST /api/submissions/:id/retry-indexing
// 🔹 NEW (step 12) — lets a user manually re-trigger repo processing
// if it previously failed (repoStatus === 'failed'). Requires
// processRepository to already be imported at the top of this file.
exports.retryIndexing = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .select('userId repoLink repoStatus');

  if (!submission) throw new ApiError(404, 'Submission not found');

  const isOwner = req.user && submission.userId?.toString() === req.user._id.toString();
  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin && !isOwner) {
    throw new ApiError(403, 'Access denied');
  }

  if (submission.repoStatus === 'processing') {
    throw new ApiError(409, 'Repository is already being processed — please wait');
  }

  if (submission.repoStatus !== 'failed') {
    throw new ApiError(400, 'Retry is only allowed when repoStatus is "failed"');
  }

  res.json(new ApiResponse(200, {}, 'Repository re-indexing started'));

  // Fire-and-forget — same pattern as createSubmission
  processRepository(submission._id.toString(), submission.repoLink).catch((err) => {
    console.error('[submissionController] retryIndexing processRepository error:', err.message);
  });
});

// ── notifySubmissionPublished ─────────────────────────────────────────────────
exports.notifySubmissionPublished = async (app, submission) => {
  try {
    await createNotification(app, submission.userId, {
      type:    'submission_published',
      message: `Your submission for "${submission.assignmentId?.title || 'a challenge'}" has been published! 🎉`,
      link:    `/submissions/${submission._id}`,
      metadata: {
        submissionId: submission._id,
        finalScore:   submission.finalScore,
      },
    });

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