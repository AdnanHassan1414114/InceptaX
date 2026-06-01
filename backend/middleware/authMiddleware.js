/**
 * middleware/authMiddleware.js
 *
 * 🔹 REDIS — checks access token blacklist on every authenticated request.
 * Refresh token validation moved to Redis (handled in authController refresh()).
 * User.refreshToken field on MongoDB is no longer checked here.
 */

const { verifyAccessToken } = require('../utils/tokenUtils');
const ApiError              = require('../utils/ApiError');
const asyncHandler          = require('../utils/asyncHandler');
const User                  = require('../models/User');
const getRedisClient        = require('../config/redisClient');
const REDIS_KEYS            = require('../config/redisKeys');

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Access token required');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  // 🔹 Check blacklist — token was invalidated on logout
  const redis       = getRedisClient();
  const blacklisted = await redis.get(REDIS_KEYS.tokenBlacklist(token));
  if (blacklisted) {
    throw new ApiError(401, 'Token has been invalidated. Please log in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  // Auto-expire plan if needed
  const activePlan     = user.getActivePlan();
  const activePlanName = activePlan.name;

  if (activePlanName !== user.plan) {
    user.plan = activePlanName;
    if (activePlanName === 'free') user.planExpiresAt = null;
    await user.save({ validateBeforeSave: false });
  }

  req.user = user;
  next();
});

module.exports = authMiddleware;