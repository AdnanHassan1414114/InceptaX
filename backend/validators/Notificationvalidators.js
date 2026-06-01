/**
 * validators/notificationValidators.js
 *
 * Zod schemas for /api/notifications routes.
 */

const { z } = require('zod');

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * GET /api/notifications  — query params
 */
const listNotifications = z.object({
  page:  z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  read:  z.enum(['true', 'false']).optional(),
});

module.exports = {
  listNotifications,
};