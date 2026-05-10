const { VibeStory, User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * Helper function to format Vibe response
 */
const formatVibeResponse = (vibe) => {
  const mediaType = vibe.imageUrl ? (vibe.imageUrl.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image') : null;
  
  // Map reporter to user for frontend compatibility
  const formattedReports = (vibe.reports || []).map(r => ({
    _id: r._id,
    user: r.reporter,
    reason: r.reason,
    createdAt: r.createdAt
  }));

  return {
    _id: vibe._id,
    user: vibe.author,
    media: vibe.imageUrl ? [{ url: vibe.imageUrl, type: mediaType }] : [],
    caption: vibe.caption,
    status: vibe.status || 'active',
    reportCount: vibe.reportCount || 0,
    reports: formattedReports,
    location: vibe.location,
    createdAt: vibe.createdAt,
    updatedAt: vibe.updatedAt,
  };
};

/**
 * GET /api/admin/vibes
 */
exports.getVibes = catchAsync(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(req.query.limit || '12', 10)));
  const skip = (page - 1) * limit;
  const status = req.query.status || 'all';
  const sortBy = req.query.sortBy || 'createdAt';
  const search = (req.query.search || '').toString().trim();

  const filter = {};
  
  if (status !== 'all') {
    if (status === 'reported') {
      filter.reportCount = { $gt: 0 };
    } else if (status === 'active') {
      filter.$or = [{ status: 'active' }, { status: { $exists: false } }];
    } else {
      filter.status = status;
    }
  }

  // Handle Search
  if (search) {
    const users = await User.find({
      $or: [
        { displayName: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');
    const userIds = users.map(u => u._id);

    filter.$or = [
      { caption: { $regex: search, $options: 'i' } },
      { author: { $in: userIds } }
    ];
  }

  const sortOption = {};
  if (sortBy === 'reportCount') {
    sortOption.reportCount = -1;
  } else {
    sortOption.createdAt = -1; // Default
  }

  const [total, vibes] = await Promise.all([
    VibeStory.countDocuments(filter),
    VibeStory.find(filter)
      .populate('author', '_id fullName displayName avatar email')
      .populate('reports.reporter', '_id fullName displayName avatar')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
  ]);

  const formattedVibes = vibes.map(formatVibeResponse);

  res.json({
    status: 'success',
    message: 'Lấy danh sách vibes thành công',
    data: {
      vibes: formattedVibes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

/**
 * GET /api/admin/vibes/:id
 */
exports.getVibe = catchAsync(async (req, res, next) => {
  const vibe = await VibeStory.findById(req.params.id)
    .populate('author', '_id fullName displayName avatar email')
    .populate('reports.reporter', '_id fullName displayName avatar');

  if (!vibe) {
    return next(new AppError('Không tìm thấy vibe', 404));
  }

  res.json({
    status: 'success',
    data: formatVibeResponse(vibe)
  });
});

/**
 * PATCH /api/admin/vibes/:id/hide
 */
exports.hideVibe = catchAsync(async (req, res, next) => {
  const vibe = await VibeStory.findByIdAndUpdate(
    req.params.id,
    { status: 'hidden' },
    { new: true }
  );

  if (!vibe) {
    return next(new AppError('Không tìm thấy vibe', 404));
  }

  // Optional: Emit Socket.io event if initialized in app
  if (req.app.get('io')) {
    req.app.get('io').emit('vibe:hidden', vibe._id);
  }

  // TODO: Create Audit Log and Send Notification to User if req.body.notifyUser is true

  res.json({
    status: 'success',
    message: 'Đã ẩn vibe thành công'
  });
});

/**
 * PATCH /api/admin/vibes/:id/approve
 */
exports.approveVibe = catchAsync(async (req, res, next) => {
  const vibe = await VibeStory.findByIdAndUpdate(
    req.params.id,
    { status: 'active', approvedAt: new Date(), approvedBy: req.user?.id },
    { new: true }
  );

  if (!vibe) {
    return next(new AppError('Không tìm thấy vibe', 404));
  }

  if (req.app.get('io')) {
    req.app.get('io').emit('vibe:approved', vibe._id);
  }

  // TODO: Create Audit Log

  res.json({
    status: 'success',
    message: 'Đã duyệt vibe thành công',
    data: formatVibeResponse(vibe)
  });
});

/**
 * PATCH /api/admin/vibes/:id/reject
 */
exports.rejectVibe = catchAsync(async (req, res, next) => {
  const { reason, notifyUser } = req.body;
  const vibe = await VibeStory.findByIdAndUpdate(
    req.params.id,
    { status: 'hidden', hiddenAt: new Date(), hiddenBy: req.user?.id, hiddenReason: reason },
    { new: true }
  );

  if (!vibe) {
    return next(new AppError('Không tìm thấy vibe', 404));
  }

  if (req.app.get('io')) {
    req.app.get('io').emit('vibe:rejected', vibe._id);
  }

  // TODO: Create Audit Log and Send Notification to User if notifyUser is true

  res.json({
    status: 'success',
    message: 'Đã từ chối vibe',
    data: formatVibeResponse(vibe)
  });
});

/**
 * PATCH /api/admin/vibes/:id/unhide
 */
exports.unhideVibe = catchAsync(async (req, res, next) => {
  const vibe = await VibeStory.findByIdAndUpdate(
    req.params.id,
    { status: 'active' },
    { new: true }
  );

  if (!vibe) {
    return next(new AppError('Không tìm thấy vibe', 404));
  }

  if (req.app.get('io')) {
    req.app.get('io').emit('vibe:unhidden', vibe._id);
  }

  res.json({
    status: 'success',
    message: 'Đã hiện vibe thành công'
  });
});

/**
 * DELETE /api/admin/vibes/:id
 */
exports.deleteVibe = catchAsync(async (req, res, next) => {
  const vibe = await VibeStory.findByIdAndDelete(req.params.id);

  if (!vibe) {
    return next(new AppError('Không tìm thấy vibe', 404));
  }

  // TODO: Delete media from S3/Cloudinary using vibe.imageUrl

  if (req.body.banUser) {
    await User.findByIdAndUpdate(vibe.author, { status: 'banned', banReason: req.body.reason });
  }

  if (req.app.get('io')) {
    req.app.get('io').emit('vibe:deleted', vibe._id);
  }

  res.json({
    status: 'success',
    message: 'Đã xóa vibe vĩnh viễn'
  });
});

/**
 * POST /api/admin/vibes/bulk-action
 */
exports.bulkAction = catchAsync(async (req, res, next) => {
  const { vibeIds, action, reason } = req.body;

  if (!vibeIds || !Array.isArray(vibeIds) || vibeIds.length === 0) {
    return next(new AppError('Vui lòng chọn ít nhất một vibe', 400));
  }

  if (action === 'hide') {
    await VibeStory.updateMany(
      { _id: { $in: vibeIds } },
      { $set: { status: 'hidden' } }
    );
    if (req.app.get('io')) {
      vibeIds.forEach(id => req.app.get('io').emit('vibe:hidden', id));
    }
  } else if (action === 'delete') {
    await VibeStory.deleteMany({ _id: { $in: vibeIds } });
    if (req.app.get('io')) {
      vibeIds.forEach(id => req.app.get('io').emit('vibe:deleted', id));
    }
  } else {
    return next(new AppError('Hành động không hợp lệ', 400));
  }

  res.json({
    status: 'success',
    message: `Đã ${action === 'hide' ? 'ẩn' : 'xóa'} ${vibeIds.length} vibes thành công`
  });
});

/**
 * GET /api/admin/vibes/stats
 */
exports.getStats = catchAsync(async (req, res, next) => {
  const [totalVibes, activeVibes, hiddenVibes, reportedVibes] = await Promise.all([
    VibeStory.countDocuments(),
    VibeStory.countDocuments({ $or: [{ status: 'active' }, { status: { $exists: false } }] }),
    VibeStory.countDocuments({ status: 'hidden' }),
    VibeStory.countDocuments({ reportCount: { $gt: 0 } })
  ]);

  res.json({
    status: 'success',
    data: {
      totalVibes,
      activeVibes,
      hiddenVibes,
      reportedVibes,
      pendingReview: reportedVibes, // For simplicity
      todayActions: 0 // Optional
    }
  });
});
