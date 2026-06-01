/**
 * controllers/assignmentController.js
 *
 * 🔹 REDIS — assignment list + individual assignment detail are cached for 5 minutes.
 * Cache is INVALIDATED on any write operation (create, update, delete) by scanning
 * and deleting all keys matching the ix:assignments:* pattern.
 *
 * Why pattern-delete instead of targeted keys:
 *   The list cache has many permutations (page, limit, difficulty, isPremium, search, tags).
 *   Tracking every permutation to delete them individually is brittle. Since writes are rare
 *   (admin only), a full pattern invalidation is safe and keeps the logic simple.
 */

const Assignment  = require('../models/Assignment');
const User        = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError    = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { PLAN_HIERARCHY }            = require('../middleware/planGuard');
const { createBulkNotifications }   = require('../utils/notificationService');
const getRedisClient                = require('../config/redisClient');
const REDIS_KEYS                    = require('../config/redisKeys');

const ASSIGNMENT_TTL = 5 * 60; // 5 minutes in seconds

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function getCached(key) {
  try {
    const redis = getRedisClient();
    const raw   = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[AssignmentCache] GET error:', err.message);
    return null;
  }
}

async function setCached(key, value, ttlSeconds) {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error('[AssignmentCache] SET error:', err.message);
  }
}

/**
 * Delete ALL assignment-related cache keys (list + individual).
 * Called after any write operation so stale data is never served.
 * Uses SCAN instead of KEYS to avoid blocking Redis in production.
 */
async function invalidateAssignmentCache() {
  try {
    const redis   = getRedisClient();
    const pattern = REDIS_KEYS.assignmentPattern(); // ix:assignments:*
    const keys    = [];
    let cursor    = '0';

    // SCAN iterates in batches — safe for large keyspaces
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[AssignmentCache] Invalidated ${keys.length} cache key(s)`);
    }
  } catch (err) {
    console.error('[AssignmentCache] Invalidation error:', err.message);
    // Never block the write operation — cache invalidation failure is non-fatal
  }
}

/**
 * Build a stable, sorted query key from request query params.
 * Sorting the keys ensures { page:1, limit:8 } and { limit:8, page:1 } produce the same key.
 */
function buildQueryKey(query) {
  const relevant = ['page', 'limit', 'difficulty', 'isPremium', 'search', 'tags'];
  return relevant
    .filter((k) => query[k] !== undefined)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&') || 'default';
}

// ── Controllers ───────────────────────────────────────────────────────────────

// GET /api/assignments
exports.getAssignments = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const { difficulty, tags, isPremium, search } = req.query;

  // 🔹 Build a per-user-plan-aware cache key
  // The plan affects the `accessible` flag on each assignment, so we include it.
  const userPlan     = req.user ? req.user.getActivePlan() : { name: 'free' };
  const userPlanName = userPlan?.name ?? userPlan;

  const queryKey = buildQueryKey(req.query) + `:plan=${userPlanName}`;
  const cacheKey = REDIS_KEYS.assignmentList(queryKey);

  // 🔹 Cache check
  const cachedData = await getCached(cacheKey);
  if (cachedData) {
    return res.json(new ApiResponse(200, cachedData));
  }

  // Cache miss — query MongoDB
  const filter = { isActive: true };
  if (difficulty)             filter.difficulty = difficulty;
  if (isPremium !== undefined) filter.isPremium = isPremium === 'true';
  if (tags)                   filter.tags       = { $in: tags.split(',').map((t) => t.trim()) };
  if (search)                 filter.title      = { $regex: search, $options: 'i' };

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .select('-createdBy')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Assignment.countDocuments(filter),
  ]);

  const enriched = assignments.map((a) => ({
    ...a.toObject(),
    accessible: PLAN_HIERARCHY[userPlanName] >= PLAN_HIERARCHY[a.requiredPlan],
  }));

  const responseData = buildPaginatedResponse(enriched, total, page, pageSize);

  // 🔹 Store in cache
  await setCached(cacheKey, responseData, ASSIGNMENT_TTL);

  res.json(new ApiResponse(200, responseData));
});

// GET /api/assignments/:id
exports.getAssignment = asyncHandler(async (req, res) => {
  // 🔹 Cache check
  const cacheKey   = REDIS_KEYS.assignmentById(req.params.id);
  const cachedData = await getCached(cacheKey);

  if (cachedData) {
    // Still enforce plan access even on cache hit
    const userPlan     = req.user ? req.user.getActivePlan() : { name: 'free' };
    const userPlanName = userPlan?.name ?? userPlan;

    if (PLAN_HIERARCHY[userPlanName] < PLAN_HIERARCHY[cachedData.assignment.requiredPlan]) {
      throw new ApiError(403, `This challenge requires a ${cachedData.assignment.requiredPlan} plan or higher`);
    }
    return res.json(new ApiResponse(200, cachedData));
  }

  // Cache miss
  const assignment = await Assignment.findOne({ _id: req.params.id, isActive: true });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const userPlan     = req.user ? req.user.getActivePlan() : { name: 'free' };
  const userPlanName = userPlan?.name ?? userPlan;

  if (PLAN_HIERARCHY[userPlanName] < PLAN_HIERARCHY[assignment.requiredPlan]) {
    throw new ApiError(403, `This challenge requires a ${assignment.requiredPlan} plan or higher`);
  }

  const responseData = { assignment };

  // 🔹 Store in cache
  await setCached(cacheKey, responseData, ASSIGNMENT_TTL);

  res.json(new ApiResponse(200, responseData));
});

// POST /api/admin/assignments
exports.createAssignment = asyncHandler(async (req, res) => {
  const { title, description, difficulty, deadline, tags, isPremium, requiredPlan, prize, coverImage } = req.body;

  if (!title || !description || !difficulty || !deadline) {
    throw new ApiError(400, 'title, description, difficulty, and deadline are required');
  }

  const assignment = await Assignment.create({
    title, description, difficulty, deadline,
    tags:         tags         || [],
    isPremium:    isPremium    || false,
    requiredPlan: requiredPlan || 'free',
    prize:        prize        || '',
    coverImage:   coverImage   || '',
    createdBy:    req.user._id,
  });

  // 🔹 Invalidate all assignment cache so the new challenge appears immediately
  await invalidateAssignmentCache();

  res.status(201).json(new ApiResponse(201, { assignment }, 'Assignment created'));

  // Notify all users — fire-and-forget after response
  try {
    const userIds = await User.find({ role: 'user' }).select('_id').lean();
    const ids     = userIds.map((u) => u._id);
    if (ids.length > 0) {
      createBulkNotifications(req.app, ids, {
        type:    'new_challenge',
        message: `New challenge: "${title}" — ${difficulty} difficulty${prize ? ` · Prize: ${prize}` : ''}`,
        link:    `/challenges/${assignment._id}`,
        metadata: { assignmentId: assignment._id, difficulty, isPremium: isPremium || false },
      });
    }
  } catch (err) {
    console.error('[assignmentController] Notification error:', err.message);
  }
});

// PUT /api/admin/assignments/:id
exports.updateAssignment = asyncHandler(async (req, res) => {
  const allowedFields = ['title', 'description', 'difficulty', 'deadline', 'tags', 'isPremium', 'requiredPlan', 'prize', 'coverImage', 'isActive'];
  const updates = {};
  allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const assignment = await Assignment.findByIdAndUpdate(req.params.id, updates, {
    new:            true,
    runValidators:  true,
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  // 🔹 Invalidate all assignment cache
  await invalidateAssignmentCache();

  res.json(new ApiResponse(200, { assignment }, 'Assignment updated'));
});

// DELETE /api/admin/assignments/:id
exports.deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  // 🔹 Invalidate all assignment cache
  await invalidateAssignmentCache();

  res.json(new ApiResponse(200, null, 'Assignment deleted'));
});