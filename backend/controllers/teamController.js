const Team = require('../models/Team');
const Assignment = require('../models/Assignment');
const TeamMessage = require('../models/TeamMessage');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { getPaginationOptions, buildPaginatedResponse } = require('../utils/pagination');
const { createNotification, createBulkNotifications } = require('../utils/notificationService');

// ─── Helper ───────────────────────────────────────────────────────────────────
function assertMember(team, userId) {
  const isMember = team.members.some((m) => m.toString() === userId.toString());
  if (!isMember) throw new ApiError(403, 'Only team members can access team chat');
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams — create a team
// ─────────────────────────────────────────────────────────────────────────────
exports.createTeam = asyncHandler(async (req, res) => {
  const { teamName, challengeId, maxMembers, requiredRoles } = req.body;

  if (!teamName || !challengeId) {
    throw new ApiError(400, 'teamName and challengeId are required');
  }

  const activePlan = req.user.getActivePlan();
  const planName = activePlan?.name ?? activePlan;
  if (planName === 'free') {
    throw new ApiError(403, 'Creating teams requires a premium plan (10-Day Sprint or Monthly Pro)');
  }

  const challenge = await Assignment.findOne({ _id: challengeId, isActive: true });
  if (!challenge) throw new ApiError(404, 'Challenge not found or is no longer active');

  const existingTeam = await Team.findOne({ challengeId, createdBy: req.user._id });
  if (existingTeam) throw new ApiError(409, 'You have already created a team for this challenge');

  const alreadyMember = await Team.findOne({ challengeId, members: req.user._id });
  if (alreadyMember) throw new ApiError(409, 'You are already a member of a team for this challenge');

  const resolvedMax = maxMembers ? Math.min(10, Math.max(2, parseInt(maxMembers, 10))) : 3;

  const team = await Team.create({
    teamName: teamName.trim(),
    challengeId,
    createdBy: req.user._id,
    members: [req.user._id],
    maxMembers: resolvedMax,
    requiredRoles: Array.isArray(requiredRoles)
      ? requiredRoles.map((r) => r.trim()).filter(Boolean)
      : [],
    status: 'Planning',
  });

  await team.populate([
    { path: 'createdBy', select: 'name username profileImage' },
    { path: 'members', select: 'name username profileImage' },
    { path: 'challengeId', select: 'title difficulty deadline' },
  ]);

  res.status(201).json(new ApiResponse(201, { team }, 'Team created successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/my  🔹 NEW
// Returns all teams the current user is a member of.
// Used by ChatContext to populate the conversation list.
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ members: req.user._id })
    .populate('createdBy', 'name username profileImage')
    .populate('members', 'name username profileImage')
    .populate('challengeId', 'title _id')
    .sort({ updatedAt: -1 });

  res.json(new ApiResponse(200, { teams }));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/:teamId
// ─────────────────────────────────────────────────────────────────────────────
exports.getTeamById = asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId)
    .populate('createdBy', 'name username profileImage')
    .populate('members', 'name username profileImage')
    .populate('challengeId', 'title difficulty deadline isPremium')
    .populate('joinRequests.userId', 'name username profileImage plan');

  if (!team) throw new ApiError(404, 'Team not found');

  const userId    = req.user._id.toString();
  const isCreator = team.createdBy._id.toString() === userId;
  const isMember  = team.members.some((m) => m._id.toString() === userId);

  const teamObj = team.toObject();
  if (!isCreator) delete teamObj.joinRequests;

  teamObj.openSpots    = team.maxMembers - team.members.length;
  teamObj.isCreator    = isCreator;
  teamObj.isMember     = isMember;
  teamObj.hasRequested = !isMember && !isCreator
    ? team.joinRequests.some((r) => r.userId?._id?.toString() === userId)
    : false;

  res.json(new ApiResponse(200, { team: teamObj }));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/challenge/:challengeId
// ─────────────────────────────────────────────────────────────────────────────
exports.getTeamsByChallenge = asyncHandler(async (req, res) => {
  const { challengeId } = req.params;

  const challenge = await Assignment.findOne({ _id: challengeId, isActive: true });
  if (!challenge) throw new ApiError(404, 'Challenge not found');

  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  const filter = { challengeId };
  if (req.query.status) {
    const validStatuses = ['Planning', 'Building', 'Completed'];
    if (!validStatuses.includes(req.query.status)) {
      throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
    }
    filter.status = req.query.status;
  }

  const userId = req.user._id.toString();

  const [teams, total] = await Promise.all([
    Team.find(filter)
      .populate('createdBy', 'name username profileImage')
      .populate('members', 'name username profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Team.countDocuments(filter),
  ]);

  const enriched = teams.map((t) => {
    const obj = t.toObject();
    obj.openSpots    = t.maxMembers - t.members.length;
    obj.isMember     = t.members.some((m) => m._id.toString() === userId);
    obj.isCreator    = t.createdBy._id.toString() === userId;
    obj.hasRequested = t.joinRequests.some((r) => r.userId?.toString() === userId);
    delete obj.joinRequests;
    return obj;
  });

  res.json(
    new ApiResponse(200, {
      challenge: { _id: challenge._id, title: challenge.title },
      ...buildPaginatedResponse(enriched, total, page, pageSize),
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/:teamId/request
// 🔹 Notification: notify team creator
// ─────────────────────────────────────────────────────────────────────────────
exports.requestToJoin = asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');

  if (team.status === 'Completed') throw new ApiError(400, 'This team has already completed the challenge');
  if (team.members.length >= team.maxMembers) throw new ApiError(400, 'This team is already full');

  const userId = req.user._id;

  if (team.members.some((m) => m.toString() === userId.toString())) {
    throw new ApiError(409, 'You are already a member of this team');
  }

  const alreadyElsewhere = await Team.findOne({
    challengeId: team.challengeId,
    members: userId,
    _id: { $ne: teamId },
  });
  if (alreadyElsewhere) throw new ApiError(409, 'You are already a member of another team for this challenge');

  if (team.joinRequests.some((r) => r.userId.toString() === userId.toString())) {
    throw new ApiError(409, 'You have already sent a join request to this team');
  }

  team.joinRequests.push({ userId });
  await team.save();

  createNotification(req.app, team.createdBy, {
    type:     'join_request_received',
    message:  `${req.user.name} wants to join your team "${team.teamName}"`,
    link:     `/team/${team._id}`,
    metadata: { teamId: team._id, requesterId: userId },
  });

  res.json(new ApiResponse(200, null, 'Join request sent successfully'));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/:teamId/requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getJoinRequests = asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId).populate(
    'joinRequests.userId',
    'name username profileImage plan'
  );
  if (!team) throw new ApiError(404, 'Team not found');

  if (team.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Only the team leader can view join requests');
  }

  res.json(
    new ApiResponse(200, {
      teamId:        team._id,
      teamName:      team.teamName,
      totalRequests: team.joinRequests.length,
      joinRequests:  team.joinRequests,
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/teams/:teamId/requests/:requestUserId
// ─────────────────────────────────────────────────────────────────────────────
exports.respondToJoinRequest = asyncHandler(async (req, res) => {
  const { teamId, requestUserId } = req.params;
  const { action } = req.body;

  if (!action || !['accept', 'reject'].includes(action)) {
    throw new ApiError(400, 'action must be either "accept" or "reject"');
  }

  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');

  if (team.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Only the team leader can respond to join requests');
  }

  const requestIndex = team.joinRequests.findIndex(
    (r) => r.userId.toString() === requestUserId
  );
  if (requestIndex === -1) throw new ApiError(404, 'Join request not found for this user');

  if (action === 'accept') {
    if (team.members.length >= team.maxMembers) {
      throw new ApiError(400, 'Team is already full — cannot accept more members');
    }

    const joinedElsewhere = await Team.findOne({
      challengeId: team.challengeId,
      members:     requestUserId,
      _id:         { $ne: teamId },
    });
    if (joinedElsewhere) {
      team.joinRequests.splice(requestIndex, 1);
      await team.save();
      throw new ApiError(409, 'This user has already joined another team. Their stale request has been removed.');
    }

    team.members.push(requestUserId);
    team.joinRequests.splice(requestIndex, 1);

    if (team.members.length >= team.maxMembers && team.status === 'Planning') {
      team.status = 'Building';
    }

    await team.save();
    await team.populate([
      { path: 'members', select: 'name username profileImage' },
      { path: 'createdBy', select: 'name username profileImage' },
    ]);

    createNotification(req.app, requestUserId, {
      type:     'member_joined',
      message:  `Your request to join "${team.teamName}" was accepted! Welcome aboard.`,
      link:     `/team/${team._id}`,
      metadata: { teamId: team._id },
    });

    const otherMemberIds = team.members
      .map((m) => m._id.toString())
      .filter((id) => id !== requestUserId && id !== team.createdBy._id.toString());

    if (otherMemberIds.length > 0) {
      createBulkNotifications(req.app, otherMemberIds, {
        type:     'member_joined',
        message:  `A new member joined your team "${team.teamName}"`,
        link:     `/team/${team._id}`,
        metadata: { teamId: team._id, newMemberId: requestUserId },
      });
    }

    return res.json(new ApiResponse(200, { team }, 'Join request accepted. Member added to team.'));
  }

  team.joinRequests.splice(requestIndex, 1);
  await team.save();
  res.json(new ApiResponse(200, null, 'Join request rejected'));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/teams/:teamId/members/:memberId
// ─────────────────────────────────────────────────────────────────────────────
exports.removeMember = asyncHandler(async (req, res) => {
  const { teamId, memberId } = req.params;
  const requesterId = req.user._id.toString();

  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');

  const isCreator = team.createdBy.toString() === requesterId;
  const isSelf    = memberId === requesterId;

  if (!isCreator && !isSelf) throw new ApiError(403, 'You do not have permission to remove this member');
  if (isCreator && isSelf)   throw new ApiError(400, 'Team leader cannot remove themselves. Disband the team instead.');

  const memberIndex = team.members.findIndex((m) => m.toString() === memberId);
  if (memberIndex === -1) throw new ApiError(404, 'This user is not a member of the team');

  team.members.splice(memberIndex, 1);

  if (team.status === 'Building' && team.members.length < team.maxMembers) {
    team.status = 'Planning';
  }

  await team.save();
  await team.populate([
    { path: 'members', select: 'name username profileImage' },
    { path: 'createdBy', select: 'name username profileImage' },
  ]);

  const message = isSelf ? 'You have left the team' : 'Member removed from team';
  res.json(new ApiResponse(200, { team }, message));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/teams/:teamId/status
// ─────────────────────────────────────────────────────────────────────────────
exports.updateTeamStatus = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { status } = req.body;

  const validStatuses = ['Planning', 'Building', 'Completed'];
  if (!status || !validStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
  }

  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');

  if (team.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Only the team leader can update the team status');
  }

  const order = { Planning: 0, Building: 1, Completed: 2 };
  if (order[status] < order[team.status]) {
    throw new ApiError(400, `Cannot move status backwards from ${team.status} to ${status}`);
  }

  team.status = status;
  await team.save();

  await team.populate([
    { path: 'members', select: 'name username profileImage' },
    { path: 'createdBy', select: 'name username profileImage' },
  ]);

  res.json(new ApiResponse(200, { team }, `Team status updated to ${status}`));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/:teamId/chat
// ─────────────────────────────────────────────────────────────────────────────
exports.getTeamMessages = asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId).select('members createdBy');
  if (!team) throw new ApiError(404, 'Team not found');

  assertMember(team, req.user._id);

  const { skip, limit, page, pageSize } = getPaginationOptions(req.query);

  const [messages, total] = await Promise.all([
    TeamMessage.find({ teamId })
      .populate('senderId', 'name username profileImage')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit),
    TeamMessage.countDocuments({ teamId }),
  ]);

  res.json(new ApiResponse(200, buildPaginatedResponse(messages, total, page, pageSize)));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/:teamId/chat
// 🔹 UPDATED — notification removed. Chat has its own unread counter system
//              in the frontend ChatContext via socket. No notification spam.
// ─────────────────────────────────────────────────────────────────────────────
exports.sendTeamMessage = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'Message cannot be empty');
  }

  const team = await Team.findById(teamId).select('members createdBy teamName');
  if (!team) throw new ApiError(404, 'Team not found');

  assertMember(team, req.user._id);

  const teamMessage = await TeamMessage.create({
    teamId,
    senderId: req.user._id,
    message:  message.trim(),
  });

  await teamMessage.populate('senderId', 'name username profileImage');

  const io = req.app.get('io');
  if (io) {
    // Emit to the team room — all connected members receive it in real-time
    io.to(`team:${teamId}`).emit('team_message', {
      ...teamMessage.toObject(),
      teamId, // ensure teamId is included for ChatContext routing
    });
  }

  // 🔹 NO notification call here — chat unread counts are managed by
  //    ChatContext via the socket event, not the notification system.

  res.status(201).json(new ApiResponse(201, { message: teamMessage }, 'Message sent'));
});