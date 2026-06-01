/**
 * validators/adminValidators.js
 *
 * Zod schemas for /api/admin routes.
 *
 * Regex patterns used:
 *  MONGO_ID_REGEX  — 24-char hex ObjectId
 *  SCORE_RANGE     — 0-100 integer
 */

const { z } = require('zod');

// ── Regex constants ───────────────────────────────────────────────────────────
const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;

const VALID_PLANS    = ['free', 'ten_day', 'monthly'];
const VALID_STATUSES = ['admin_reviewed', 'published', 'rejected'];

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * PATCH /api/admin/users/:id/plan  — update a user's plan
 */
const updateUserPlan = z.object({
  plan: z.enum(VALID_PLANS, {
    required_error: 'plan is required',
    invalid_type_error: `plan must be one of: ${VALID_PLANS.join(', ')}`,
  }),
  planExpiresAt: z
    .string()
    .datetime({ message: 'planExpiresAt must be a valid ISO 8601 date string' })
    .optional(),
});

/**
 * PATCH /api/admin/submissions/:id/review  — review a submission
 */
const reviewSubmission = z.object({
  adminScore: z
    .number()
    .int('adminScore must be an integer')
    .min(0, 'adminScore cannot be less than 0')
    .max(100, 'adminScore cannot exceed 100')
    .optional(),

  adminNotes: z
    .string()
    .trim()
    .max(2000, 'adminNotes cannot exceed 2000 characters')
    .optional()
    .or(z.literal('')),

  status: z
    .enum(VALID_STATUSES, {
      invalid_type_error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    })
    .optional(),
})
.refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field (adminScore, adminNotes, or status) must be provided' }
);

/**
 * POST /api/admin/email/blast  — send an email blast
 */
const emailBlast = z.object({
  subject: z
    .string({ required_error: 'subject is required' })
    .trim()
    .min(3, 'Subject must be at least 3 characters')
    .max(150, 'Subject cannot exceed 150 characters'),

  body: z
    .string({ required_error: 'body is required' })
    .trim()
    .min(10, 'Body must be at least 10 characters'),

  targetPlan: z
    .enum(VALID_PLANS, {
      invalid_type_error: `targetPlan must be one of: ${VALID_PLANS.join(', ')}`,
    })
    .optional(),
});

/**
 * GET /api/admin/users  — query params
 */
const listUsers = z.object({
  page:   z.coerce.number().int().min(1).optional().default(1),
  limit:  z.coerce.number().int().min(1).max(100).optional().default(20),
  plan:   z.enum(VALID_PLANS).optional(),
  role:   z.enum(['user', 'admin']).optional(),
  search: z.string().trim().max(100).optional(),
});

/**
 * GET /api/admin/submissions  — query params
 */
const listSubmissions = z.object({
  page:         z.coerce.number().int().min(1).optional().default(1),
  limit:        z.coerce.number().int().min(1).max(100).optional().default(20),
  status:       z.enum(['pending', 'ai_evaluated', 'admin_reviewed', 'published', 'rejected']).optional(),
  assignmentId: z
    .string()
    .regex(MONGO_ID_REGEX, 'assignmentId must be a valid ID')
    .optional(),
});

module.exports = {
  updateUserPlan,
  reviewSubmission,
  emailBlast,
  listUsers,
  listSubmissions,
};