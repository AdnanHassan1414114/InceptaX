require('dotenv').config();

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const cron         = require('node-cron');
const passport     = require('./config/passportConfig');

const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { verifyAccessToken } = require('./utils/tokenUtils');
const { createBulkNotifications } = require('./utils/notificationService');
const { sendDeadlineReminderEmails } = require('./utils/emailService'); // 🔹 NEW

// Routes
const authRoutes         = require('./routes/authRoutes');
const userRoutes         = require('./routes/userRoutes');
const assignmentRoutes   = require('./routes/assignmentRoutes');
const submissionRoutes   = require('./routes/submissionRoutes');
const chatRoutes         = require('./routes/chatRoutes');
const leaderboardRoutes  = require('./routes/leaderboardRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const teamRoutes         = require('./routes/teamRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes      = require('./routes/paymentRoutes');

// Models (for cron)
const Assignment = require('./models/Assignment');
const Submission = require('./models/Submission');
const User       = require('./models/User');

const app        = express();
const httpServer = http.createServer(app);

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
app.set('io', io);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/assignments',   assignmentRoutes);
app.use('/api/submissions',   submissionRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/leaderboard',   leaderboardRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/teams',         teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payment',       paymentRoutes);

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Socket auth + rooms ──────────────────────────────────────────────────────
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) throw new Error('No token');
    const decoded = verifyAccessToken(token);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  if (socket.userId) socket.join(`user:${socket.userId}`);

  socket.on('join_teams', (teamIds) => {
    if (!Array.isArray(teamIds)) return;
    teamIds.forEach((id) => {
      if (typeof id === 'string' && id.length === 24) socket.join(`team:${id}`);
    });
  });

  socket.on('join_submission', (submissionId) => {
    if (typeof submissionId === 'string' && submissionId.length === 24) {
      socket.join(`submission:${submissionId}`);
    }
  });

  socket.on('disconnect', () => socket.leave(`user:${socket.userId}`));
});

// ── Deadline cron — runs every hour ─────────────────────────────────────────
// 🔹 UPDATED — now sends both in-app notifications AND emails
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running deadline-approaching check...');
  try {
    const now   = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await Assignment.find({
      isActive: true,
      deadline: { $gt: now, $lt: in24h },
    }).select('_id title deadline');

    if (upcoming.length === 0) {
      console.log('[CRON] No assignments expiring in 24h.');
      return;
    }

    for (const assignment of upcoming) {
      const submittedIds = await Submission.find({ assignmentId: assignment._id }).distinct('userId');
      const eligible     = await User.find({ role: 'user', _id: { $nin: submittedIds } })
        .select('_id email name').lean();

      if (!eligible.length) continue;

      const userIds   = eligible.map((u) => u._id);
      const hoursLeft = Math.round((new Date(assignment.deadline) - now) / (1000 * 60 * 60));

      // In-app notification (unchanged)
      await createBulkNotifications(app, userIds, {
        type:    'deadline_approaching',
        message: `⏰ "${assignment.title}" closes in ~${hoursLeft}h — don't miss out!`,
        link:    `/challenges/${assignment._id}`,
        metadata: { assignmentId: assignment._id, deadline: assignment.deadline, hoursLeft },
      });

      // 🔹 Email reminder — fire-and-forget
      sendDeadlineReminderEmails(eligible, {
        _id:      assignment._id,
        title:    assignment.title,
        deadline: assignment.deadline,
        hoursLeft,
      });

      console.log(`[CRON] Deadline reminders sent for "${assignment.title}" → ${eligible.length} users`);
    }
  } catch (err) {
    console.error('[CRON] Error:', err.message);
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});