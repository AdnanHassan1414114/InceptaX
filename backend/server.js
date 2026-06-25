require('dotenv').config();

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const cron         = require('node-cron');
const rateLimit    = require('express-rate-limit'); // 🔹 NEW
const passport     = require('./config/passportConfig');

const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { verifyAccessToken }         = require('./utils/tokenUtils');
const { createBulkNotifications }   = require('./utils/notificationService');
const { sendDeadlineReminderEmails } = require('./utils/emailService');
const { initChatPubSub, closeChatPubSub } = require('./utils/chatPubSub'); // 🔹 NEW

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

// 🔹 Initialize Redis Pub/Sub for team chat.
// Must be called AFTER io is created and BEFORE any messages can be sent.
// The subscriber pattern-subscribes to ix:chat:team:* and re-emits
// incoming payloads to the correct Socket.io room on this instance.
initChatPubSub(io);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ── Rate Limiting ──────────────────────────────────────────────────────────

// Global limiter — applies to all routes
// 100 requests per IP per 15 minutes
const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              100,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             (req) => req.path === '/health', // skip health check
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down and try again later.',
    });
  },
});

// Auth limiter — stricter, applies to /api/auth/* only
// 20 requests per IP per 15 minutes
// FIX: skip OAuth (google/github) and refresh routes — these aren't brute-force
// targets like login/register, and normal OAuth redirect flows + token refresh
// polling were tripping this limit during regular use, not just attacks.
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) =>
    req.path.startsWith('/google') ||
    req.path.startsWith('/github') ||
    req.path === '/refresh',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many auth attempts. Please wait 15 minutes before trying again.',
    });
  },
});

// Apply global limiter to all routes
app.use(globalLimiter);

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);  // 🔹 stricter limit on auth
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
  // Personal room for notifications
  if (socket.userId) socket.join(`user:${socket.userId}`);

  // Join team rooms — client sends array of teamIds it's a member of.
  // The socket rooms are used by chatPubSub.js subscriber to re-emit
  // messages from Redis to the right clients on THIS instance.
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

      await createBulkNotifications(app, userIds, {
        type:    'deadline_approaching',
        message: `⏰ "${assignment.title}" closes in ~${hoursLeft}h — don't miss out!`,
        link:    `/challenges/${assignment._id}`,
        metadata: { assignmentId: assignment._id, deadline: assignment.deadline, hoursLeft },
      });

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

// ── Graceful shutdown ────────────────────────────────────────────────────────
// 🔹 Close Redis pub/sub connections cleanly on process exit so ioredis
//    doesn't log errors about abrupt disconnects.
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully`);
  await closeChatPubSub();
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});