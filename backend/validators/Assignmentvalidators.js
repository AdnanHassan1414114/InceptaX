/**
 * validators/assignmentValidators.js
 *
 * Zod schemas for /api/assignments and /api/admin/assignments routes.
 *
 * Regex patterns used:
 *  TAG_REGEX   — tag must be 1-30 chars, letters/digits/+/#/./- and spaces
 *  URL_REGEX   — optional cover image must be a valid http/https URL
 */

const { z } = require('zod');

// ── Regex constants ───────────────────────────────────────────────────────────
const TAG_REGEX = /^[a-zA-Z0-9+#.\-\s]{1,30}$/;
const URL_REGEX = /^https?:\/\/.+\..+/;

const DIFFICULTIES    = ['easy', 'medium', 'hard'];
const REQUIRED_PLANS  = ['free', 'ten_day', 'monthly'];

// ── Reusable fields ───────────────────────────────────────────────────────────
const tagsField = z
  .array(
    z
      .string()
      .trim()
      .regex(TAG_REGEX, 'Each tag must be 1-30 characters (letters, digits, +, #, ., -, spaces)')
  )
  .max(10, 'Maximum 10 tags allowed')
  .optional()
  .default([]);

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/assignments  — create assignment
 */
const createAssignment = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),

  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(20, 'Description must be at least 20 characters'),

  difficulty: z.enum(DIFFICULTIES, {
    required_error: 'Difficulty is required',
    invalid_type_error: `Difficulty must be one of: ${DIFFICULTIES.join(', ')}`,
  }),

  deadline: z
    .string({ required_error: 'Deadline is required' })
    .datetime({ message: 'Deadline must be a valid ISO 8601 date string' })
    .refine((v) => new Date(v) > new Date(), {
      message: 'Deadline must be in the future',
    }),

  tags: tagsField,

  isPremium: z.boolean().optional().default(false),

  requiredPlan: z
    .enum(REQUIRED_PLANS, {
      invalid_type_error: `requiredPlan must be one of: ${REQUIRED_PLANS.join(', ')}`,
    })
    .optional()
    .default('free'),

  prize: z
    .string()
    .trim()
    .max(100, 'Prize description cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),

  coverImage: z
    .string()
    .trim()
    .refine((v) => v === '' || URL_REGEX.test(v), {
      message: 'Cover image must be a valid URL starting with http:// or https://',
    })
    .optional()
    .or(z.literal('')),
});

/**
 * PUT /api/admin/assignments/:id  — update assignment (all fields optional)
 */
const updateAssignment = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, 'Title must be at least 5 characters')
      .max(200, 'Title cannot exceed 200 characters')
      .optional(),

    description: z
      .string()
      .trim()
      .min(20, 'Description must be at least 20 characters')
      .optional(),

    difficulty: z.enum(DIFFICULTIES).optional(),

    deadline: z
      .string()
      .datetime({ message: 'Deadline must be a valid ISO 8601 date string' })
      .optional(),

    tags: tagsField,

    isPremium:    z.boolean().optional(),
    requiredPlan: z.enum(REQUIRED_PLANS).optional(),

    prize: z
      .string()
      .trim()
      .max(100, 'Prize description cannot exceed 100 characters')
      .optional()
      .or(z.literal('')),

    coverImage: z
      .string()
      .trim()
      .refine((v) => v === '' || URL_REGEX.test(v), {
        message: 'Cover image must be a valid URL',
      })
      .optional()
      .or(z.literal('')),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

/**
 * GET /api/assignments  — query param filters
 */
const listAssignments = z.object({
  page:       z.coerce.number().int().min(1).optional().default(1),
  limit:      z.coerce.number().int().min(1).max(100).optional().default(8),
  difficulty: z.enum(DIFFICULTIES).optional(),
  isPremium:  z.enum(['true', 'false']).optional(),
  search:     z.string().trim().max(100).optional(),
  tags:       z.string().optional(), // comma-separated, parsed in controller
});

module.exports = {
  createAssignment,
  updateAssignment,
  listAssignments,
};