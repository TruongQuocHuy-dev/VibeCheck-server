const AppError = require('../utils/AppError');

/**
 * Global Express error handler.
 */
const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const message = err.isOperational ? err.message : 'Đã xảy ra lỗi máy chủ.';

  if (process.env.NODE_ENV === 'development') {
    console.error('🔴 ERROR:', err);
  }

  const responseBody = { status, message };
  if (err.code) {
    responseBody.code = err.code;
  }
  if (err.banReason) {
    responseBody.banReason = err.banReason;
  }

  return res.status(statusCode).json(responseBody);
};

module.exports = errorMiddleware;
