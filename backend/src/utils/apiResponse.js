/**
 * Send a successful response.
 */
export const sendSuccess = (
  res,
  { statusCode = 200, message, data, meta } = {},
) => {
  const payload = { success: true };

  if (message) payload.message = message;
  if (data !== undefined) payload.data = data;
  if (meta) payload.meta = meta;

  return res.status(statusCode).json(payload);
};

/**
 * Send a successful, paginated list response.
 */
export const sendPaginated = (
  res,
  { data, page, limit, total, statusCode = 200, message } = {},
) => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) || 1 : 1;

  const payload = {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };

  if (message) payload.message = message;

  return res.status(statusCode).json(payload);
};

/**
 * Send an error response.
 */
export const sendError = (
  res,
  { statusCode = 500, message = "Internal server error", errors, ...rest } = {},
) => {
  const payload = { success: false, message };

  if (errors) payload.errors = errors;
  Object.assign(payload, rest);

  return res.status(statusCode).json(payload);
};
