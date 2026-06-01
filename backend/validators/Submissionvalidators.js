/**
 * validators/submissionValidators.js
 *
 * Zod schemas for /api/submissions routes.
 *
 * Regex patterns used:
 *  GITHUB_REPO_REGEX — must be a valid github.com repository URL
 *  HTTP_URL_REGEX    — generic http/https URL for live demo link
 *  MONGO_ID_REGEX    — 24-char hex ObjectId
 *  USERNAME_REGEX    — lowercase letters/digits/underscores, 3-24 chars
 */

const { z } = require('zod');

// ── Regex constants ───────────────────────────────────────────────────────────
const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
const HTTP_URL_REGEX    = /^https?:\/\/.+\..+/;
const MONGO_ID_REGEX    = /^[a-f\d]{24}$/i;
const USERNAME_REGEX    = /^[a-z0-9_]{1,24}$/;

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * POST /api/submissions  — create a submission
 */
const createSubmission = z.object({
  assignmentId: z
    .string({ required_error: 'assignmentId is required' })
    .regex(MONGO_ID_REGEX, 'assignmentId must be a valid ID'),

  repoLink: z
    .string({ required_error: 'GitHub repository URL is required' })
    .trim()
    .regex(
      GITHUB_REPO_REGEX,
      'repoLink must be a valid GitHub repository URL (e.g. https://github.com/user/repo)'
    ),

  liveLink: z
    .string()
    .trim()
    .refine((v) => v === '' || HTTP_URL_REGEX.test(v), {
      message: 'liveLink must be a valid URL starting with http:// or https://',
    })
    .optional()
    .or(z.literal('')),

  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional()
    .or(z.literal('')),

  teamMembers: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(USERNAME_REGEX, 'Each team member must be a valid username')
    )
    .max(9, 'You cannot add more than 9 team members')
    .optional()
    .default([]),
});

/**
 * GET /api/submissions/assignment/:id — query params
 */
const listByAssignment = z.object({
  page:   z.coerce.number().int().min(1).optional().default(1),
  limit:  z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z
    .enum(['pending', 'ai_evaluated', 'admin_reviewed', 'published', 'rejected'])
    .optional(),
});

module.exports = {
  createSubmission,
  listByAssignment,
};