const { verifyAccessToken } = require('../utils/tokenUtils');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

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

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user) {
    throw new ApiError(401, 'User no longer exists');
  }

  // 🔹 FIXED — getActivePlan() returns { name, isActive, expiresAt? }, NOT a string.
  // The original compared the whole object to user.plan (a string), which was
  // always unequal (object !== string), triggering a DB save on every request.
  // Now we correctly extract `.name` before comparing.
  const activePlan     = user.getActivePlan();
  const activePlanName = activePlan.name; // 🔹 string: "free" | "ten_day" | "monthly"

  if (activePlanName !== user.plan) {
    user.plan = activePlanName;
    if (activePlanName === 'free') user.planExpiresAt = null;
    await user.save({ validateBeforeSave: false });
  }

  req.user = user;
  next();
});

module.exports = authMiddleware;