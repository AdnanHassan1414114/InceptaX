/**
 * validators/userValidators.js
 *
 * Zod schemas for all /api/users routes.
 *
 * Regex patterns used:
 *  URL_REGEX       — must start with http:// or https://
 *  USERNAME_REGEX  — 3-24 chars, lowercase letters/digits/underscores
 *  GITHUB_REGEX    — valid GitHub username (alphanumeric + hyphens, 1-39 chars)
 *  SKILL_REGEX     — 1-30 chars, letters/digits/+/#/./ /- allowed (e.g. "Node.js", "C++")
 */

const { z } = require('zod');

// ── Regex constants ───────────────────────────────────────────────────────────
const URL_REGEX    = /^https?:\/\/.+\..+/;
const GITHUB_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const SKILL_REGEX  = /^[a-zA-Z0-9+#.\-\s]{1,30}$/;

// ── Optional URL helper ───────────────────────────────────────────────────────
const optionalUrl = (label) =>
  z
    .string()
    .trim()
    .max(500, `${label} URL is too long`)
    .refine((v) => v === '' || URL_REGEX.test(v), {
      message: `${label} must be a valid URL starting with http:// or https://`,
    })
    .optional()
    .or(z.literal(''));

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * PUT /api/users/me/profile
 */
const updateProfile = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name cannot exceed 60 characters')
      .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
      .optional(),

    bio: z
      .string()
      .trim()
      .max(300, 'Bio cannot exceed 300 characters')
      .optional()
      .or(z.literal('')),

    githubUsername: z
      .string()
      .trim()
      .regex(GITHUB_REGEX, 'Invalid GitHub username')
      .optional()
      .or(z.literal('')),

    profileImage: optionalUrl('Profile image'),

    skills: z
      .array(
        z
          .string()
          .trim()
          .regex(SKILL_REGEX, 'Each skill must be 1-30 characters (letters, digits, +, #, ., -, spaces)')
      )
      .max(15, 'You can add at most 15 skills')
      .optional(),

    socialLinks: z
      .object({
        twitter:  optionalUrl('Twitter'),
        linkedin: optionalUrl('LinkedIn'),
        website:  optionalUrl('Website'),
      })
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
  );

/**
 * GET /api/users/:username  (params validation)
 */
const usernameParam = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(24, 'Username is too long'),
});

module.exports = {
  updateProfile,
  usernameParam,
};