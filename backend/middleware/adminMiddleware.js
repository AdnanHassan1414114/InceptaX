const ApiError = require('../utils/ApiError');

const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  next();
};

module.exports = adminMiddleware;
