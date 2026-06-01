/**
 * routes/teamRoutes.js  — with Zod validation
 */
const express = require('express');
const router  = express.Router();

const {
  createTeam,
  getMyTeams,
  getTeamById,
  getTeamsByChallenge,
  requestToJoin,
  getJoinRequests,
  respondToJoinRequest,
  removeMember,
  updateTeamStatus,
  getTeamMessages,
  sendTeamMessage,
} = require('../controllers/teamController');

const authMiddleware  = require('../middleware/authMiddleware');
const validate        = require('../validators/validate');
const teamSchemas     = require('../validators/teamValidators');

// POST /api/teams
router.post(
  '/',
  authMiddleware,
  validate(teamSchemas.createTeam),
  createTeam
);

// GET /api/teams/my — must be before /:teamId
router.get('/my', authMiddleware, getMyTeams);

// GET /api/teams/challenge/:challengeId — must be before /:teamId
router.get(
  '/challenge/:challengeId',
  authMiddleware,
  validate(teamSchemas.listTeamsByChallenge, 'query'),
  getTeamsByChallenge
);

// GET /api/teams/:teamId
router.get(
  '/:teamId',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  getTeamById
);

// POST /api/teams/:teamId/request
router.post(
  '/:teamId/request',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  requestToJoin
);

// GET /api/teams/:teamId/requests
router.get(
  '/:teamId/requests',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  getJoinRequests
);

// PATCH /api/teams/:teamId/requests/:requestUserId
router.patch(
  '/:teamId/requests/:requestUserId',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  validate(teamSchemas.respondToJoinRequest),
  respondToJoinRequest
);

// DELETE /api/teams/:teamId/members/:memberId
router.delete(
  '/:teamId/members/:memberId',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  removeMember
);

// PATCH /api/teams/:teamId/status
router.patch(
  '/:teamId/status',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  validate(teamSchemas.updateTeamStatus),
  updateTeamStatus
);

// GET /api/teams/:teamId/chat
router.get(
  '/:teamId/chat',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  validate(teamSchemas.listTeamMessages, 'query'),
  getTeamMessages
);

// POST /api/teams/:teamId/chat
router.post(
  '/:teamId/chat',
  authMiddleware,
  validate(teamSchemas.teamIdParam, 'params'),
  validate(teamSchemas.sendTeamMessage),
  sendTeamMessage
);

module.exports = router;