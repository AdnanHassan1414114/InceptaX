const Assignment = require('../models/Assignment');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { PLAN_HIERARCHY } = require('../middleware/planGuard');
const { createBulkNotifications } = require('../utils/notificationService'); // 🔹 NEW

// GET /api/assignments
exports.getAssignments = asyncHandler(async (req, res) => {
  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);
  const { difficulty, tags, isPremium, search } = req.query;

  const filter = { isActive: true };

  if (difficulty) filter.difficulty = difficulty;
  if (isPremium !== undefined) filter.isPremium = isPremium === 'true';
  if (tags) filter.tags = { $in: tags.split(',').map((t) => t.trim()) };
  if (search) filter.title = { $regex: search, $options: 'i' };

  const userPlan = req.user ? req.user.getActivePlan() : { name: 'free' };
  const userPlanName = userPlan?.name ?? userPlan;

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

  res.json(new ApiResponse(200, buildPaginatedResponse(enriched, total, page, pageSize)));
});

// GET /api/assignments/:id
exports.getAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, isActive: true });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const userPlan = req.user ? req.user.getActivePlan() : { name: 'free' };
  const userPlanName = userPlan?.name ?? userPlan;

  if (PLAN_HIERARCHY[userPlanName] < PLAN_HIERARCHY[assignment.requiredPlan]) {
    throw new ApiError(403, `This challenge requires a ${assignment.requiredPlan} plan or higher`);
  }

  res.json(new ApiResponse(200, { assignment }));
});

// POST /api/admin/assignments
// 🔹 UPDATED — notify all users after creation
exports.createAssignment = asyncHandler(async (req, res) => {
  const { title, description, difficulty, deadline, tags, isPremium, requiredPlan, prize, coverImage } = req.body;

  if (!title || !description || !difficulty || !deadline) {
    throw new ApiError(400, 'title, description, difficulty, and deadline are required');
  }

  const assignment = await Assignment.create({
    title,
    description,
    difficulty,
    deadline,
    tags: tags || [],
    isPremium: isPremium || false,
    requiredPlan: requiredPlan || 'free',
    prize: prize || '',
    coverImage: coverImage || '',
    createdBy: req.user._id,
  });

  res.status(201).json(new ApiResponse(201, { assignment }, 'Assignment created'));

  // 🔹 Notify all non-admin users — fire-and-forget AFTER response is sent
  try {
    const userIds = await User.find({ role: 'user' }).select('_id').lean();
    const ids = userIds.map((u) => u._id);

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
    new: true,
    runValidators: true,
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

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

  res.json(new ApiResponse(200, null, 'Assignment deleted'));
});