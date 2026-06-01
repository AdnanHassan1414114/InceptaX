/**
 * validators/teamValidators.js
 *
 * Zod schemas for all /api/teams routes.
 *
 * Regex patterns used:
 *  TEAM_NAME_REGEX — 3-60 chars, letters/digits/spaces/hyphens/apostrophes
 *  ROLE_REGEX      — a role label, 1-40 chars, letters/digits/spaces/+-
 *  MONGO_ID_REGEX  — 24-char hex ObjectId
 */

const { z } = require('zod');

// ── Regex constants ───────────────────────────────────────────────────────────
const TEAM_NAME_REGEX = /^[a-zA-Z0-9\s\-']{3,60}$/;
const ROLE_REGEX      = /^[a-zA-Z0-9\s\+\-]{1,40}$/;
const MONGO_ID_REGEX  = /^[a-f\d]{24}$/i;

const TEAM_STATUSES = ['Planning', 'Building', 'Completed'];

// ── Shared param schema ───────────────────────────────────────────────────────
const teamIdParam = z.object({
  teamId: z
    .string({ required_error: 'teamId is required' })
    .regex(MONGO_ID_REGEX, 'teamId must be a valid ID'),
});

// ── Schemas ───────────────────────────────────────────────────────────────────

/**
 * POST /api/teams  — create a team
 */
const createTeam = z.object({
  teamName: z
    .string({ required_error: 'Team name is required' })
    .trim()
    .regex(
      TEAM_NAME_REGEX,
      'Team name must be 3-60 characters (letters, digits, spaces, hyphens, apostrophes)'
    ),

  challengeId: z
    .string({ required_error: 'challengeId is required' })
    .regex(MONGO_ID_REGEX, 'challengeId must be a valid ID'),

  maxMembers: z
    .number()
    .int('maxMembers must be an integer')
    .min(2, 'Team must allow at least 2 members')
    .max(10, 'Team cannot exceed 10 members')
    .optional()
    .default(3),

  requiredRoles: z
    .array(
      z
        .string()
        .trim()
        .regex(ROLE_REGEX, 'Each role must be 1-40 characters (letters, digits, spaces, +, -)')
    )
    .max(10, 'Maximum 10 required roles')
    .optional()
    .default([]),

  status: z.enum(TEAM_STATUSES).optional().default('Planning'),
});

/**
 * PATCH /api/teams/:teamId/status  — update team status
 */
const updateTeamStatus = z.object({
  status: z.enum(TEAM_STATUSES, {
    required_error: 'status is required',
    invalid_type_error: `status must be one of: ${TEAM_STATUSES.join(', ')}`,
  }),
});

/**
 * PATCH /api/teams/:teamId/requests/:requestUserId  — accept or reject join request
 */
const respondToJoinRequest = z.object({
  action: z.enum(['accept', 'reject'], {
    required_error: 'action is required',
    invalid_type_error: 'action must be "accept" or "reject"',
  }),
});

/**
 * POST /api/teams/:teamId/chat  — send a team message
 */
const sendTeamMessage = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
});

/**
 * GET /api/teams/challenge/:challengeId  — query params
 */
const listTeamsByChallenge = z.object({
  page:  z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * GET /api/teams/:teamId/chat  — query params
 */
const listTeamMessages = z.object({
  page:  z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

module.exports = {
  teamIdParam,
  createTeam,
  updateTeamStatus,
  respondToJoinRequest,
  sendTeamMessage,
  listTeamsByChallenge,
  listTeamMessages,
};