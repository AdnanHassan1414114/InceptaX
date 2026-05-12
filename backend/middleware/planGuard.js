const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const PLAN_HIERARCHY = { free: 0, ten_day: 1, monthly: 2 };

/**
 * Returns middleware that checks if the user's active plan meets requiredPlan.
 * Must be used AFTER authMiddleware (req.user must already be set).
 *
 * @param {string} requiredPlan - Minimum plan: "free" | "ten_day" | "monthly"
 */
const planGuard = (requiredPlan) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    // 🔹 FIXED — getActivePlan() returns { name, isActive, expiresAt? }.
    // Original code passed the whole object as a key into PLAN_HIERARCHY,
    // which returned undefined (object can't be an object key lookup → NaN),
    // so the comparison always failed and everyone was treated as insufficient plan.
    const activePlan     = req.user.getActivePlan();
    const activePlanName = activePlan.name; // 🔹 extract the string

    if (PLAN_HIERARCHY[activePlanName] < PLAN_HIERARCHY[requiredPlan]) {
      throw new ApiError(
        403,
        `This resource requires a ${requiredPlan} plan or higher`
      );
    }

    next();
  });

module.exports = { planGuard, PLAN_HIERARCHY };