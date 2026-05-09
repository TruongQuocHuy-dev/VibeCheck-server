const AppError = require('../utils/AppError');
const User = require('../models/User.model');
const catchAsync = require('../utils/catchAsync');

/**
 * Middleware: restrict access to specific roles.
 * Must be used after authenticate middleware.
 */
const restrictTo = (...roles) => {
  return catchAsync(async (req, res, next) => {
    // req.user only has id from authenticate middleware
    const user = await User.findById(req.user.id).select('role');
    
    if (!user || !roles.includes(user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này.', 403)
      );
    }

    next();
  });
};

module.exports = { restrictTo };
