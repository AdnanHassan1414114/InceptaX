/**
 * Builds mongoose pagination options from query params.
 * @param {Object} query - Express req.query
 * @returns {{ skip, limit, page, pageSize }}
 */
const getPaginationOptions = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * pageSize;
  return { skip, limit: pageSize, page, pageSize };
};

/**
 * Builds the paginated response metadata.
 */
const buildPaginatedResponse = (data, total, page, pageSize) => ({
  data,
  pagination: {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNextPage: page * pageSize < total,
    hasPrevPage: page > 1,
  },
});

module.exports = { getPaginationOptions, buildPaginatedResponse };
