const jwt = require('jsonwebtoken');

// ✅ ACCESS TOKEN
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

// ✅ REFRESH TOKEN
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

// ✅ VERIFY ACCESS TOKEN (🔥 MISSING FIX)
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// ✅ VERIFY REFRESH TOKEN
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ✅ COOKIE OPTIONS
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // set true in production
  sameSite: 'lax',
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken, // 🔥 ADD THIS
  verifyRefreshToken,
  REFRESH_COOKIE_OPTIONS,
};