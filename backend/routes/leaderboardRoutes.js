const express = require('express');
const router = express.Router();
const { getGlobalLeaderboard, getAssignmentLeaderboard } = require('../controllers/leaderboardController');

router.get('/', getGlobalLeaderboard);
router.get('/assignment/:id', getAssignmentLeaderboard);

module.exports = router;
