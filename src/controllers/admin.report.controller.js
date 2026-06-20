const { UserReport, User, VibeStory } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * GET /api/admin/reports
 * Get list of reports in queue
 */
exports.getReports = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const { status = 'pending', type = 'all', priority = 'all', page = 1, limit = 15 } = req.query;

  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (type && type !== 'all') {
    filter.targetType = type;
  }
  if (priority && priority !== 'all') {
    filter.priority = priority;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [reportsRaw, total] = await Promise.all([
    UserReport.find(filter)
      .populate('reporter', 'fullName displayName avatar')
      .populate('reportedUser', 'fullName displayName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    UserReport.countDocuments(filter),
  ]);

  const reports = reportsRaw.map((report) => {
    const repObj = report.toObject();
    
    // Dynamic fallback for targetData if not set (legacy or basic user reports)
    if (!repObj.targetData && repObj.reportedUser) {
      repObj.targetType = 'user';
      repObj.targetId = repObj.reportedUser._id;
      repObj.targetData = {
        avatar: repObj.reportedUser.avatar,
        fullName: repObj.reportedUser.fullName || repObj.reportedUser.displayName || 'Người dùng VibeCheck',
      };
    }
    
    // Default fallback values
    if (!repObj.status) repObj.status = 'pending';
    if (!repObj.priority) repObj.priority = 'normal';
    if (!repObj.type) repObj.type = repObj.targetType || 'user';
    
    return repObj;
  });

  res.json({
    status: 'success',
    data: {
      reports,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * GET /api/admin/reports/:id
 * Get single report detail
 */
exports.getReportDetail = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const report = await UserReport.findById(req.params.id)
    .populate('reporter', 'fullName displayName avatar')
    .populate('reportedUser', 'fullName displayName avatar');

  if (!report) {
    return next(new AppError('Không tìm thấy báo cáo.', 404));
  }

  const repObj = report.toObject();
  
  if (!repObj.targetData && repObj.reportedUser) {
    repObj.targetType = 'user';
    repObj.targetId = repObj.reportedUser._id;
    repObj.targetData = {
      avatar: repObj.reportedUser.avatar,
      fullName: repObj.reportedUser.fullName || repObj.reportedUser.displayName || 'Người dùng VibeCheck',
    };
  }

  if (!repObj.status) repObj.status = 'pending';
  if (!repObj.priority) repObj.priority = 'normal';
  if (!repObj.type) repObj.type = repObj.targetType || 'user';

  res.json({
    status: 'success',
    data: repObj,
  });
});

/**
 * PATCH /api/admin/reports/:id/resolve
 * Resolve a report
 */
exports.resolveReport = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const { id } = req.params;
  const { action, note } = req.body;

  if (!action) {
    return next(new AppError('Hành động xử lý (action) là bắt buộc.', 400));
  }

  const report = await UserReport.findById(id);
  if (!report) {
    return next(new AppError('Không tìm thấy báo cáo.', 404));
  }

  // Resolve status
  report.status = action === 'dismiss' ? 'dismissed' : 'resolved';
  report.resolutionNote = note || '';
  report.resolvedBy = req.user.id;
  report.resolvedAt = new Date();

  // Execute Action
  const targetId = report.targetId || report.reportedUser;
  const targetType = report.targetType || 'user';

  if (action === 'user_banned') {
    // Ban the user
    const updatedUser = await User.findByIdAndUpdate(
      report.reportedUser,
      { status: 'banned', banReason: note || 'Bị cấm do báo cáo vi phạm.' },
      { new: true }
    );

    if (updatedUser) {
      // socket.io push and disconnect
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.to(`user:${updatedUser._id}`).emit('account_banned', {
          status: 'banned',
          reason: updatedUser.banReason,
          message: 'Tài khoản của bạn đã bị đình chỉ.',
        });

        const roomSockets = io.sockets.adapter.rooms.get(`user:${updatedUser._id}`);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s) {
              setTimeout(() => s.disconnect(true), 1000);
            }
          }
        }
      } catch (err) {
        console.error('Socket ban notification error:', err);
      }
    }
  } else if (action === 'content_deleted') {
    if (targetType === 'story' && targetId) {
      await VibeStory.findByIdAndUpdate(targetId, { status: 'hidden' });
    }
    // If targetType is user, maybe we reset profile metadata (fallback)
    if (targetType === 'user') {
      await User.findByIdAndUpdate(targetId, {
        displayName: 'User Violated',
        bio: 'Bio đã bị gỡ do vi phạm chính sách cộng đồng.',
        profileModerationStatus: 'rejected',
      });
    }
  }

  await report.save();

  res.json({
    status: 'success',
    message: 'Báo cáo đã được xử lý thành công.',
    data: report,
  });
});
