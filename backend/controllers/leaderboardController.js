/**
 * controllers/leaderboardController.js
 *
 * 🔹 REDIS — global + per-assignment leaderboard results are cached for 2 minutes.
 * These are the most expensive aggregate queries in the app (full collection scans).
 * Cache is NOT manually invalidated — TTL expiry is sufficient since scores only
 * change when an admin publishes/updates a submission, which happens infrequently.
 */

const Submission    = require('../models/Submission');
const Assignment    = require('../models/Assignment');
const asyncHandler  = require('../utils/asyncHandler');
const ApiError      = require('../utils/ApiError');
const ApiResponse   = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const getRedisClient = require('../config/redisClient');
const REDIS_KEYS     = require('../config/redisKeys');

const LEADERBOARD_TTL = 2 * 60; // 2 minutes in seconds

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * Try to return a cached JSON value from Redis.
 * Returns the parsed object on hit, null on miss or error.
 */
async function getCached(key) {
  try {
    const redis = getRedisClient();
    const raw   = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[LeaderboardCache] GET error:', err.message);
    return null; // degrade gracefully — never block the request
  }
}

/**
 * Store a value in Redis as JSON with a TTL.
 * Errors are swallowed so a Redis failure never breaks the response.
 */
async function setCached(key, value, ttlSeconds) {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error('[LeaderboardCache] SET error:', err.message);
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

// GET /api/leaderboard — global leaderboard across all assignments
exports.getGlobalLeaderboard = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  // 🔹 Cache check
  const cacheKey    = REDIS_KEYS.globalLeaderboard(page, limit);
  const cachedData  = await getCached(cacheKey);

  if (cachedData) {
    return res.json(new ApiResponse(200, cachedData));
  }

  // Cache miss — run the expensive aggregation
  const pipeline = [
    { $match: { status: 'published', finalScore: { $ne: null } } },
    {
      $group: {
        _id:         '$userId',
        totalScore:  { $sum: '$finalScore' },
        submissions: { $sum: 1 },
        bestScore:   { $max: '$finalScore' },
      },
    },
    { $sort: { totalScore: -1, bestScore: -1 } },
    {
      $lookup: {
        from:         'users',
        localField:   '_id',
        foreignField: '_id',
        as:           'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id:         0,
        userId:      '$_id',
        totalScore:  1,
        submissions: 1,
        bestScore:   1,
        'user.name':         1,
        'user.username':     1,
        'user.profileImage': 1,
      },
    },
  ];

  const allResults = await Submission.aggregate(pipeline);
  const total      = allResults.length;
  const paginated  = allResults.slice(skip, skip + limit).map((entry, idx) => ({
    ...entry,
    rank: skip + idx + 1,
  }));

  const responseData = buildPaginatedResponse(paginated, total, page, pageSize);

  // 🔹 Store in cache
  await setCached(cacheKey, responseData, LEADERBOARD_TTL);

  res.json(new ApiResponse(200, responseData));
});

// GET /api/leaderboard/assignment/:id — per-assignment leaderboard
exports.getAssignmentLeaderboard = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const assignmentId = req.params.id;

  // 🔹 Cache check
  const cacheKey   = REDIS_KEYS.assignmentLeaderboard(assignmentId, page, limit);
  const cachedData = await getCached(cacheKey);

  if (cachedData) {
    return res.json(new ApiResponse(200, cachedData));
  }

  // Cache miss
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const filter = {
    assignmentId,
    status:     'published',
    finalScore: { $ne: null },
  };

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('userId', 'name username profileImage')
      .sort({ finalScore: -1, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter),
  ]);

  const ranked = submissions.map((s, idx) => ({
    rank:       skip + idx + 1,
    submission: s,
  }));

  const responseData = {
    assignment: { _id: assignment._id, title: assignment.title },
    ...buildPaginatedResponse(ranked, total, page, pageSize),
  };

  // 🔹 Store in cache
  await setCached(cacheKey, responseData, LEADERBOARD_TTL);

  res.json(new ApiResponse(200, responseData));
});