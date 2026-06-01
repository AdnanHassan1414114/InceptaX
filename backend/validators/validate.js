/**
 * validators/validate.js
 *
 * Generic Zod validation middleware factory.
 * Usage:  router.post('/register', validate(authSchemas.register), handler)
 *
 * By default validates req.body. Pass a second argument to validate other parts:
 *   validate(schema, 'params')  — validates req.params
 *   validate(schema, 'query')   — validates req.query
 */

const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

/**
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'params'|'query'} source
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    // Zod v4 uses .issues; v3 used .errors — support both
    const issues = result.error.issues ?? result.error.errors ?? [];
    const errors = issues.map((e) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));

    // First error message as the main message, full list in errors[]
    const firstMessage = errors[0]?.message || 'Validation failed';
    return next(new ApiError(400, firstMessage, errors));
  }

  // Replace req[source] with the parsed (and coerced/stripped) data
  req[source] = result.data;
  next();
};

module.exports = validate;