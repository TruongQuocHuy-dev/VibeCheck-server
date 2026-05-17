const { verifyAccessToken } = require('../utils/token');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { User } = require('../models');

/**
 * Middleware: verify JWT access token from Authorization header.
 * Sets req.user = { id, role, status } on success.
 */
const authenticate = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Thiếu token xác thực.', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    
    // Fetch user status from database to enforce instant bans
    const user = await User.findById(decoded.id).select('status role banReason');
    if (!user) {
      return next(new AppError('Người dùng không tồn tại hoặc đã bị xóa.', 401));
    }

    if (user.status === 'banned') {
      const err = new AppError('Tài khoản của bạn đã bị đình chỉ.', 403);
      err.code = 'BANNED';
      err.banReason = user.banReason || 'Vi phạm Tiêu chuẩn Cộng đồng của chúng tôi.';
      return next(err);
    }

    req.user = { id: decoded.id, role: user.role, status: user.status };
    next();
  } catch (err) {
    if (err.statusCode === 403) {
      return next(err);
    }
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn.', 401));
  }
});

module.exports = { authenticate };
