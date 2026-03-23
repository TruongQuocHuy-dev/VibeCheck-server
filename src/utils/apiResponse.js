/**
 * Standard API response formatters.
 */
const success = (res, data, statusCode = 200, message = 'Success') => {
  return res.status(statusCode).json({ status: 'success', message, data });
};

const error = (res, message, statusCode = 500) => {
  return res.status(statusCode).json({ status: 'error', message });
};

module.exports = { success, error };
