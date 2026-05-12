const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { planGuard } = require('../middleware/planGuard'); // 🔹 NEW

// GET /api/chat/:submissionId — read messages (auth + premium required)
// 🔹 planGuard('ten_day') ensures free users get a clean 403 before hitting the controller.
//    The controller also enforces this independently as a defence-in-depth measure.
router.get('/:submissionId', authMiddleware, planGuard('ten_day'), getMessages);

// POST /api/chat/:submissionId — send a message (auth + premium required)
router.post('/:submissionId', authMiddleware, planGuard('ten_day'), sendMessage);

module.exports = router;