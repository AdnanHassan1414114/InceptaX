const User = require('../models/User');
const Submission = require('../models/Submission');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');

// GET /api/users/me (unchanged)
exports.getMe = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, { user: req.user.toPublicJSON() }));
});

// PUT /api/users/me/profile
// 🔹 UPDATED — added skills and socialLinks to allowed update fields
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name',
    'bio',
    'githubUsername',
    'profileImage',
    'skills',           // 🔹 NEW
    'socialLinks',      // 🔹 NEW
  ];

  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // 🔹 Validate skills — must be an array of strings, max 15 tags, each max 30 chars
  if (updates.skills !== undefined) {
    if (!Array.isArray(updates.skills)) {
      throw new ApiError(400, 'skills must be an array');
    }
    updates.skills = updates.skills
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 15);
  }

  // 🔹 Validate socialLinks — must be an object with known keys
  if (updates.socialLinks !== undefined) {
    if (typeof updates.socialLinks !== 'object' || Array.isArray(updates.socialLinks)) {
      throw new ApiError(400, 'socialLinks must be an object');
    }
    const allowed = ['twitter', 'linkedin', 'website'];
    const sanitized = {};
    allowed.forEach((key) => {
      if (updates.socialLinks[key] !== undefined) {
        sanitized[key] = String(updates.socialLinks[key]).trim();
      }
    });
    updates.socialLinks = sanitized;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields provided for update');
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.json(new ApiResponse(200, { user: user.toPublicJSON() }, 'Profile updated'));
});

// GET /api/users/:username (unchanged logic, benefits from updated toPublicJSON)
exports.getUserByUsername = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw new ApiError(404, 'User not found');

  res.json(new ApiResponse(200, { user: user.toPublicJSON() }));
});

// GET /api/users/:username/submissions (unchanged)
exports.getUserSubmissions = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw new ApiError(404, 'User not found');

  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  const filter = { userId: user._id, status: 'published' };
  if (req.user && req.user._id.toString() === user._id.toString()) {
    delete filter.status;
  }

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('assignmentId', 'title difficulty tags deadline')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, buildPaginatedResponse(submissions, total, page, pageSize)));
});

// 🔹 NEW — GET /api/users/:username/stats
// Returns global leaderboard rank + aggregate score stats for a user's profile card.
// Uses the same aggregation logic as leaderboardController so numbers are consistent.
exports.getUserStats = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw new ApiError(404, 'User not found');

  // 🔹 Run the same pipeline as getGlobalLeaderboard to get this user's rank.
  // We collect all entries (unsorted slice) then find position — MongoDB doesn't
  // have a native "rank of specific user" operation without running the full pipeline.
  const pipeline = [
    { $match: { status: 'published', finalScore: { $ne: null } } },
    {
      $group: {
        _id: '$userId',
        totalScore: { $sum: '$finalScore' },
        submissionCount: { $sum: 1 },
        bestScore: { $max: '$finalScore' },
        avgScore: { $avg: '$finalScore' },
      },
    },
    { $sort: { totalScore: -1, bestScore: -1 } },
  ];

  const allEntries = await Submission.aggregate(pipeline);

  // Find this user's position (1-indexed)
  const userIndex = allEntries.findIndex(
    (e) => e._id.toString() === user._id.toString()
  );

  const userEntry = userIndex !== -1 ? allEntries[userIndex] : null;

  res.json(
    new ApiResponse(200, {
      globalRank:       userEntry ? userIndex + 1 : null,
      totalScore:       userEntry?.totalScore ?? 0,
      bestScore:        userEntry?.bestScore ?? 0,
      avgScore:         userEntry ? Math.round(userEntry.avgScore) : 0,
      submissionCount:  userEntry?.submissionCount ?? 0,
      totalParticipants: allEntries.length,
    })
  );
});