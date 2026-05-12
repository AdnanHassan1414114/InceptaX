const express = require('express');
const router = express.Router();
const {
  createTeam,
  getMyTeams,          // 🔹 NEW
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
const authMiddleware = require('../middleware/authMiddleware');

// POST   /api/teams                              — create a team
router.post('/', authMiddleware, createTeam);

// GET    /api/teams/my                           — get current user's teams 🔹 NEW
// NOTE: must be declared before /:teamId to prevent "my" being treated as a teamId
router.get('/my', authMiddleware, getMyTeams);

// GET    /api/teams/challenge/:challengeId       — list teams for a challenge
// NOTE: must be before /:teamId for the same reason
router.get('/challenge/:challengeId', authMiddleware, getTeamsByChallenge);

// GET    /api/teams/:teamId                      — fetch a single team
router.get('/:teamId', authMiddleware, getTeamById);

// POST   /api/teams/:teamId/request              — send a join request
router.post('/:teamId/request', authMiddleware, requestToJoin);

// GET    /api/teams/:teamId/requests             — view pending requests (creator)
router.get('/:teamId/requests', authMiddleware, getJoinRequests);

// PATCH  /api/teams/:teamId/requests/:userId     — accept or reject a request
router.patch('/:teamId/requests/:requestUserId', authMiddleware, respondToJoinRequest);

// DELETE /api/teams/:teamId/members/:memberId    — remove member or leave
router.delete('/:teamId/members/:memberId', authMiddleware, removeMember);

// PATCH  /api/teams/:teamId/status               — update team status (creator)
router.patch('/:teamId/status', authMiddleware, updateTeamStatus);

// GET    /api/teams/:teamId/chat                 — fetch messages (members)
router.get('/:teamId/chat', authMiddleware, getTeamMessages);

// POST   /api/teams/:teamId/chat                 — send a message (members)
router.post('/:teamId/chat', authMiddleware, sendTeamMessage);

module.exports = router;