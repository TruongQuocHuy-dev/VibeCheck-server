const { verifyAccessToken } = require('../utils/token');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Middleware: verify JWT access token from Authorization header.
 * Sets req.user = { id } on success.
 */
const authenticate = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Thiếu token xác thực.', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.id };
    next();
  } catch (err) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn.', 401));
  }
});

module.exports = { authenticate };
