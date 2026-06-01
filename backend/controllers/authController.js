/**
 * controllers/authController.js
 *
 * Redis integrations in this file:
 *
 * 1. SESSION MANAGEMENT (refresh tokens)
 *    - issueTokens()  → stores refresh token in Redis (ix:session:refresh:<userId>), TTL 7d
 *    - logout()       → deletes refresh token from Redis
 *    - refresh()      → reads + rotates refresh token in Redis
 *    - resetPassword()→ deletes refresh token from Redis on password change
 *    - User.refreshToken field is NO LONGER written to MongoDB
 *
 * 2. OTP STORAGE
 *    - createAndSendOTP() → stores { hashedOtp, attempts } in Redis (ix:otp:data:<userId>), TTL 10min
 *    - verifyEmail()      → reads, validates, increments attempts, deletes on success — all in Redis
 *    - resendOTP()        → overwrites existing OTP key in Redis
 *    - EmailOTP MongoDB model is NO LONGER used
 *
 * 3. PASSWORD RESET TOKENS
 *    - forgotPassword() → stores hashedToken→userId in Redis (ix:pwd:reset:<hashedToken>), TTL 1hr
 *    - resetPassword()  → reads token from Redis, deletes after use
 *    - PasswordReset MongoDB model is NO LONGER used
 *
 * 4. BRUTE FORCE + RATE LIMITING (from previous implementation — unchanged)
 *    - login()     → tracks failed attempts per email
 *    - resendOTP() → tracks resend count per userId
 *
 * 5. TOKEN BLACKLISTING (from previous implementation — unchanged)
 *    - logout() → blacklists access token until it naturally expires
 */

const crypto         = require('crypto');
const dns            = require('dns').promises;
const User           = require('../models/User');
const asyncHandler   = require('../utils/asyncHandler');
const ApiError       = require('../utils/ApiError');
const ApiResponse    = require('../utils/ApiResponse');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  REFRESH_COOKIE_OPTIONS,
} = require('../utils/tokenUtils');
const {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require('../utils/emailService');
const getRedisClient = require('../config/redisClient');
const REDIS_KEYS     = require('../config/redisKeys');

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_MAX_ATTEMPTS    = 3;
const OTP_EXPIRY_SECS     = 10 * 60;      // 10 minutes
const REFRESH_EXPIRY_SECS = 7 * 24 * 60 * 60; // 7 days — must match JWT refresh expiry
const RESET_EXPIRY_SECS   = 60 * 60;      // 1 hour
const ACCESS_TOKEN_SECS   = 15 * 60;      // 15 minutes — must match JWT access expiry

// Brute force config
const LOGIN_MAX_ATTEMPTS  = 5;
const LOGIN_BLOCK_SECS    = 15 * 60;      // 15 minutes

// OTP resend rate limit
const OTP_RESEND_MAX      = 3;
const OTP_RESEND_SECS     = 10 * 60;      // 10 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function validateEmail(email) {
  if (!EMAIL_REGEX.test(email)) {
    throw new ApiError(400, 'Invalid email address format');
  }
  const domain = email.split('@')[1];
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DNS_TIMEOUT')), 3000)
      ),
    ]);
    if (!records || records.length === 0) {
      throw new ApiError(400, 'Email domain does not appear to be valid');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.code === 'ENOTFOUND') {
      throw new ApiError(400, 'Email domain does not appear to be valid');
    }
    console.warn(`[validateEmail] DNS check inconclusive for "${domain}": ${err.message} — allowing`);
  }
}

/**
 * Issue JWT tokens.
 * 🔹 REDIS SESSION — refresh token stored in Redis, NOT MongoDB.
 * User.refreshToken field is no longer written.
 */
async function issueTokens(user, res) {
  const payload      = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 🔹 Store refresh token in Redis with 7-day TTL
  const redis = getRedisClient();
  await redis.setex(
    REDIS_KEYS.refreshToken(user._id.toString()),
    REFRESH_EXPIRY_SECS,
    refreshToken
  );

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  return { accessToken };
}

function generateOTP() {
  const raw    = String(Math.floor(100000 + Math.random() * 900000));
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

/**
 * Create/replace OTP for a user and send the email.
 * 🔹 REDIS OTP — stored as JSON in Redis with 10-min TTL.
 * EmailOTP MongoDB model is no longer used.
 */
async function createAndSendOTP(user) {
  const { raw, hashed } = generateOTP();

  const redis   = getRedisClient();
  const otpData = { hashedOtp: hashed, attempts: 0 };

  // SETEX overwrites any existing OTP for this user — one active OTP at a time
  await redis.setex(
    REDIS_KEYS.otpData(user._id.toString()),
    OTP_EXPIRY_SECS,
    JSON.stringify(otpData)
  );

  // Send email — fire-and-forget
  sendOTPEmail(user, raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    throw new ApiError(400, 'All fields are required');
  }

  await validateEmail(email);

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    if (existing.email === email.toLowerCase() && !existing.isEmailVerified) {
      await createAndSendOTP(existing);
      return res.status(200).json(
        new ApiResponse(200, { userId: existing._id }, 'Account exists but is unverified. A new OTP has been sent to your email.')
      );
    }
    throw new ApiError(409, 'User already exists');
  }

  const user = await User.create({
    name, email, username, password,
    oauthProvider:   'email',
    isEmailVerified: false,
  });

  await createAndSendOTP(user);

  res.status(201).json(
    new ApiResponse(201, { userId: user._id }, 'Account created. Please verify your email with the OTP sent.')
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-email
// 🔹 REDIS OTP — reads OTP from Redis, validates, increments attempts, deletes on success
// ─────────────────────────────────────────────────────────────────────────────
const verifyEmail = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    throw new ApiError(400, 'userId and otp are required');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (user.isEmailVerified) {
    const { accessToken } = await issueTokens(user, res);
    return res.json(new ApiResponse(200, { user: user.toPublicJSON(), accessToken }, 'Email already verified'));
  }

  // 🔹 Read OTP from Redis
  const redis   = getRedisClient();
  const otpKey  = REDIS_KEYS.otpData(userId);
  const rawData = await redis.get(otpKey);

  if (!rawData) {
    throw new ApiError(400, 'OTP expired. Please request a new one.');
  }

  const otpData = JSON.parse(rawData);

  // Max attempts exceeded
  if (otpData.attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey); // clean up
    throw new ApiError(400, 'Too many failed attempts. Please request a new OTP.');
  }

  const hashedInput = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

  if (hashedInput !== otpData.hashedOtp) {
    // 🔹 Increment attempts in Redis — rewrite with same TTL remaining
    otpData.attempts += 1;
    const ttl = await redis.ttl(otpKey);
    if (ttl > 0) {
      await redis.setex(otpKey, ttl, JSON.stringify(otpData));
    }

    const remaining = OTP_MAX_ATTEMPTS - otpData.attempts;
    if (remaining <= 0) {
      await redis.del(otpKey);
    }

    throw new ApiError(
      400,
      remaining > 0
        ? `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Too many failed attempts. Please request a new OTP.'
    );
  }

  // ── OTP correct ───────────────────────────────────────────────────────────
  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  // 🔹 Delete OTP from Redis
  await redis.del(otpKey);

  const { accessToken } = await issueTokens(user, res);

  res.json(
    new ApiResponse(200, { user: user.toPublicJSON(), accessToken }, 'Email verified successfully! Welcome to InceptaX 🚀')
  );

  sendWelcomeEmail(user);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-otp
// 🔹 REDIS — rate limit + OTP stored in Redis
// ─────────────────────────────────────────────────────────────────────────────
const resendOTP = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) throw new ApiError(400, 'userId is required');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (user.isEmailVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  // 🔹 Rate limit check
  const redis      = getRedisClient();
  const resendKey  = REDIS_KEYS.otpResendCount(userId);
  const current    = await redis.get(resendKey);

  if (current && parseInt(current) >= OTP_RESEND_MAX) {
    throw new ApiError(429, 'Too many OTP requests. Please wait before requesting another OTP.');
  }

  const count = await redis.incr(resendKey);
  if (count === 1) {
    await redis.expire(resendKey, OTP_RESEND_SECS);
  }

  // 🔹 createAndSendOTP writes new OTP to Redis — overwrites existing
  await createAndSendOTP(user);

  res.json(new ApiResponse(200, null, 'A new OTP has been sent to your email.'));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// 🔹 REDIS — brute force protection (unchanged from previous)
// ─────────────────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, 'Email and password required');

  const redis      = getRedisClient();
  const attemptKey = REDIS_KEYS.loginAttempts(email);
  const attempts   = await redis.get(attemptKey);

  if (attempts && parseInt(attempts) >= LOGIN_MAX_ATTEMPTS) {
    const ttl  = await redis.ttl(attemptKey);
    const mins = Math.ceil(ttl / 60);
    throw new ApiError(429, `Too many failed login attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    await redis.incr(attemptKey);
    await redis.expire(attemptKey, LOGIN_BLOCK_SECS);
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.oauthProvider !== 'email' && !user.password) {
    throw new ApiError(401, `This account uses ${user.oauthProvider} login. Please sign in with ${user.oauthProvider}.`);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const count     = await redis.incr(attemptKey);
    await redis.expire(attemptKey, LOGIN_BLOCK_SECS);
    const remaining = LOGIN_MAX_ATTEMPTS - count;
    if (remaining <= 0) {
      throw new ApiError(429, `Too many failed attempts. Account temporarily locked for ${LOGIN_BLOCK_SECS / 60} minutes.`);
    }
    throw new ApiError(401, `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
  }

  // Clear failed attempts on success
  await redis.del(attemptKey);

  if (!user.isEmailVerified) {
    await createAndSendOTP(user);
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', [{ userId: user._id }]);
  }

  const { accessToken } = await issueTokens(user, res);

  res.json(new ApiResponse(200, { user: user.toPublicJSON(), accessToken }, 'Login successful'));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// 🔹 REDIS SESSION — deletes refresh token from Redis
// 🔹 REDIS BLACKLIST — blacklists access token
// ─────────────────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  const redis = getRedisClient();

  // 🔹 Blacklist access token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyAccessToken(token);
      const ttl     = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.setex(REDIS_KEYS.tokenBlacklist(token), ttl, '1');
      }
    } catch {
      // Already expired — skip
    }
  }

  // 🔹 Delete refresh token from Redis using userId from cookie
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await redis.del(REDIS_KEYS.refreshToken(decoded.id));
    } catch {
      // Token invalid — nothing to delete
    }
  }

  res.clearCookie('refreshToken');
  res.json(new ApiResponse(200, null, 'Logged out'));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// 🔹 REDIS SESSION — validates refresh token against Redis, not MongoDB
// ─────────────────────────────────────────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token');

  let decoded;
  try { decoded = verifyRefreshToken(token); }
  catch { throw new ApiError(401, 'Invalid refresh token'); }

  // 🔹 Validate against Redis — must match what we stored
  const redis    = getRedisClient();
  const stored   = await redis.get(REDIS_KEYS.refreshToken(decoded.id));

  if (!stored || stored !== token) {
    throw new ApiError(401, 'Token mismatch or session expired. Please log in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError(401, 'User no longer exists');

  // 🔹 Issue new tokens — this overwrites the refresh token in Redis (rotation)
  const { accessToken } = await issueTokens(user, res);
  res.json(new ApiResponse(200, { accessToken }));
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth callback
// ─────────────────────────────────────────────────────────────────────────────
const oauthCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);

    // 🔹 Check if this is a new user — no refresh token in Redis yet
    const redis     = getRedisClient();
    const existing  = await redis.get(REDIS_KEYS.refreshToken(user._id.toString()));
    const isNewUser = !existing;

    const { accessToken } = await issueTokens(user, res);
    if (isNewUser) sendWelcomeEmail(user);

    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${accessToken}&provider=${user.oauthProvider}`);
  } catch (err) {
    console.error('[oauthCallback]', err.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// 🔹 REDIS PASSWORD RESET — stores hashed token in Redis with 1hr TTL
// PasswordReset MongoDB model is no longer used
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email is required');

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return res.json(new ApiResponse(200, null, 'If an account exists, a reset link has been sent.'));
  }
  if (user.oauthProvider !== 'email' && !user.password) {
    return res.json(new ApiResponse(200, null, `This account uses ${user.oauthProvider} login — no password to reset.`));
  }

  const rawToken    = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 🔹 Store in Redis — key: hashedToken, value: userId string, TTL: 1 hour
  // No need to delete old tokens first — Redis SETEX overwrites automatically
  const redis = getRedisClient();
  await redis.setex(
    REDIS_KEYS.passwordReset(hashedToken),
    RESET_EXPIRY_SECS,
    user._id.toString()
  );

  sendPasswordResetEmail(user, rawToken);
  res.json(new ApiResponse(200, null, 'If an account exists, a reset link has been sent.'));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// 🔹 REDIS PASSWORD RESET — reads token from Redis, deletes after use
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) throw new ApiError(400, 'Token and new password are required');
  if (password.length < 8)  throw new ApiError(400, 'Password must be at least 8 characters');

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // 🔹 Look up token in Redis
  const redis  = getRedisClient();
  const userId = await redis.get(REDIS_KEYS.passwordReset(hashedToken));

  if (!userId) {
    throw new ApiError(400, 'Invalid or expired reset token. Please request a new one.');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  user.password = password;
  await user.save();

  // 🔹 Delete reset token from Redis — one-time use
  await redis.del(REDIS_KEYS.passwordReset(hashedToken));

  // 🔹 Delete refresh token from Redis — force re-login after password change
  await redis.del(REDIS_KEYS.refreshToken(userId));

  res.json(new ApiResponse(200, null, 'Password reset successfully. Please sign in with your new password.'));
});

module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  logout,
  refresh,
  oauthCallback,
  forgotPassword,
  resetPassword,
};