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

// ✅ VERIFY ACCESS TOKEN (MISSING FIX)
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// ✅ VERIFY REFRESH TOKEN
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// ✅ COOKIE OPTIONS
// FIX: secure was hardcoded false — now automatically true in production
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production', // was: false
  sameSite: 'lax',
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken, //  ADD THIS
  verifyRefreshToken,
  REFRESH_COOKIE_OPTIONS,
};