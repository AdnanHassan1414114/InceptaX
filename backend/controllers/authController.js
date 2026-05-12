const crypto         = require('crypto');
const User           = require('../models/User');
const PasswordReset  = require('../models/PasswordReset');
const asyncHandler   = require('../utils/asyncHandler');
const ApiError       = require('../utils/ApiError');
const ApiResponse    = require('../utils/ApiResponse');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_OPTIONS,
} = require('../utils/tokenUtils');
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require('../utils/emailService'); // 🔹 NEW

// ── Shared helper: issue tokens, persist refresh token, set cookie ─────────
async function issueTokens(user, res) {
  const payload      = { id: user._id, role: user.role };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  return { accessToken, refreshToken };
}

// ✅ REGISTER
const register = asyncHandler(async (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    throw new ApiError(400, 'All fields are required');
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) throw new ApiError(409, 'User already exists');

  const user = await User.create({ name, email, username, password, oauthProvider: 'email' });
  const { accessToken } = await issueTokens(user, res);

  res.status(201).json(
    new ApiResponse(201, { user: user.toPublicJSON(), accessToken }, 'Registration successful')
  );

  // 🔹 Send welcome email after response — fire-and-forget
  sendWelcomeEmail(user);
});

// ✅ LOGIN
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, 'Email and password required');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');
  if (!user) throw new ApiError(401, 'Invalid credentials');

  if (user.oauthProvider !== 'email' && !user.password) {
    throw new ApiError(401, `This account uses ${user.oauthProvider} login. Please sign in with ${user.oauthProvider}.`);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid credentials');

  const { accessToken } = await issueTokens(user, res);

  res.json(
    new ApiResponse(200, { user: user.toPublicJSON(), accessToken }, 'Login successful')
  );
});

// ✅ LOGOUT
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await User.findOneAndUpdate({ refreshToken: token }, { refreshToken: null });
  res.clearCookie('refreshToken');
  res.json(new ApiResponse(200, null, 'Logged out'));
});

// ✅ REFRESH TOKEN
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, 'No refresh token');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) throw new ApiError(401, 'Token mismatch');

  const { accessToken } = await issueTokens(user, res);
  res.json(new ApiResponse(200, { accessToken }));
});

// ✅ OAUTH CALLBACK
const oauthCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);

    // 🔹 Send welcome email only for brand-new OAuth users (no refreshToken = first login)
    const isNewUser = !user.refreshToken;

    const { accessToken } = await issueTokens(user, res);

    if (isNewUser) sendWelcomeEmail(user);

    const redirectUrl = `${process.env.CLIENT_URL}/auth/dashboard?token=${accessToken}&provider=${user.oauthProvider}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[oauthCallback] Error:', err.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
};

// 🔹 NEW — FORGOT PASSWORD
// POST /api/auth/forgot-password
// Generates a secure reset token, stores hashed version in DB, emails raw token
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) throw new ApiError(400, 'Email is required');

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always respond 200 regardless of whether email exists (prevents user enumeration)
  if (!user) {
    return res.json(
      new ApiResponse(200, null, 'If an account with that email exists, a reset link has been sent.')
    );
  }

  // Block reset for OAuth-only accounts (they have no password to reset)
  if (user.oauthProvider !== 'email' && !user.password) {
    return res.json(
      new ApiResponse(200, null, `This account uses ${user.oauthProvider} login — no password to reset.`)
    );
  }

  // Invalidate any existing reset tokens for this user
  await PasswordReset.deleteMany({ userId: user._id });

  // Generate a cryptographically secure random token
  const rawToken    = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  await PasswordReset.create({
    userId:    user._id,
    token:     hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  // Send email with raw token (only raw token leaves the server)
  sendPasswordResetEmail(user, rawToken);

  res.json(
    new ApiResponse(200, null, 'If an account with that email exists, a reset link has been sent.')
  );
});

// 🔹 NEW — RESET PASSWORD
// POST /api/auth/reset-password
// Verifies raw token against stored hash, updates password, invalidates token
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new ApiError(400, 'Token and new password are required');
  }

  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  // Hash the incoming raw token to compare with DB
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const resetRecord = await PasswordReset.findOne({
    token:     hashedToken,
    expiresAt: { $gt: new Date() }, // not expired
  });

  if (!resetRecord) {
    throw new ApiError(400, 'Invalid or expired reset token. Please request a new one.');
  }

  const user = await User.findById(resetRecord.userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  // Update password — pre-save hook will hash it
  user.password = password;
  // Invalidate all existing sessions by clearing refreshToken
  user.refreshToken = null;
  await user.save();

  // Delete the used reset token
  await PasswordReset.deleteMany({ userId: user._id });

  res.json(new ApiResponse(200, null, 'Password reset successfully. Please sign in with your new password.'));
});

module.exports = { register, login, logout, refresh, oauthCallback, forgotPassword, resetPassword };