const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');

// GET /api/leaderboard — global leaderboard across all assignments
exports.getGlobalLeaderboard = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  // Aggregate: best submission per user (highest finalScore)
  const pipeline = [
    { $match: { status: 'published', finalScore: { $ne: null } } },
    {
      $group: {
        _id: '$userId',
        totalScore: { $sum: '$finalScore' },
        submissions: { $sum: 1 },
        bestScore: { $max: '$finalScore' },
      },
    },
    { $sort: { totalScore: -1, bestScore: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        totalScore: 1,
        submissions: 1,
        bestScore: 1,
        'user.name': 1,
        'user.username': 1,
        'user.profileImage': 1,
      },
    },
  ];

  const allResults = await Submission.aggregate(pipeline);
  const total = allResults.length;
  const paginated = allResults.slice(skip, skip + limit).map((entry, idx) => ({
    ...entry,
    rank: skip + idx + 1,
  }));

  res.json(new ApiResponse(200, buildPaginatedResponse(paginated, total, page, pageSize)));
});

// GET /api/leaderboard/assignment/:id — per-assignment leaderboard
exports.getAssignmentLeaderboard = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const filter = { assignmentId: req.params.id, status: 'published', finalScore: { $ne: null } };

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('userId', 'name username profileImage')
      .sort({ finalScore: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);

  const ranked = submissions.map((s, idx) => ({
    rank: skip + idx + 1,
    submission: s,
  }));

  res.json(
    new ApiResponse(200, {
      assignment: { _id: assignment._id, title: assignment.title },
      ...buildPaginatedResponse(ranked, total, page, pageSize),
    })
  );
});
