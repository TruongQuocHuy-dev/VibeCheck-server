const { User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * GET /admin/vibes/moderation
 * Tìm users có isProfileComplete: true, lọc theo profileModerationStatus
 */
exports.getVibesModeration = catchAsync(async (req, res, next) => {
  const { status } = req.query; // 'pending', 'approved', 'rejected', 'hidden', 'active', 'all'

  // Map legacy 'hidden' and 'active' to 'rejected' and 'approved'
  let queryStatus = status;
  if (status === 'hidden') queryStatus = 'rejected';
  if (status === 'active') queryStatus = 'approved';

  const filter = { isProfileComplete: true, role: { $ne: 'admin' } };
  if (queryStatus && queryStatus !== 'all') {
    filter.profileModerationStatus = queryStatus;
  }

  const users = await User.find(filter)
    .select('fullName displayName birthYear bio avatar vibes photos gender profileModerationStatus createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const vibes = users.map(user => {
    return {
      _id: user._id,
      photos: user.photos || [],
      status: user.profileModerationStatus === 'rejected' ? 'hidden' : (user.profileModerationStatus === 'approved' ? 'active' : 'pending'),
      createdAt: user.createdAt || Date.now(),
      user: {
        _id: user._id,
        fullName: user.fullName || user.displayName,
        displayName: user.displayName,
        avatar: user.avatar,
        birthYear: user.birthYear,
        gender: user.gender,
        bio: user.bio,
        vibeTags: (user.vibes || []).filter(v => typeof v === 'string')
      }
    };
  });

  res.json({
    status: 'success',
    data: {
      vibes,
      total: vibes.length
    }
  });
});

/**
 * PATCH /admin/vibes/:userId/moderate
 * Cập nhật profileModerationStatus của user
 */
exports.moderateVibe = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  let newStatus = status;
  if (status === 'active') newStatus = 'approved';
  if (status === 'hidden') newStatus = 'rejected';

  if (!['approved', 'rejected', 'pending'].includes(newStatus)) {
    return next(new AppError('Trạng thái không hợp lệ', 400));
  }

  const user = await User.findByIdAndUpdate(
    id,
    { profileModerationStatus: newStatus },
    { new: true }
  );

  if (!user) {
    return next(new AppError('Không tìm thấy người dùng', 404));
  }

  res.json({
    status: 'success',
    message: `Đã cập nhật trạng thái hồ sơ thành ${newStatus}`,
    data: { vibeId: id, status }
  });
});

/**
 * DELETE /admin/vibes/:userId
 * Xóa dữ liệu hồ sơ vi phạm và ẩn khỏi discovery
 */
exports.deleteVibe = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findByIdAndUpdate(
    id,
    { 
      avatar: null,
      bio: null,
      photos: [],
      vibes: [],
      isProfileComplete: false,
      profileModerationStatus: 'rejected'
    },
    { new: true }
  );

  if (!user) {
    return next(new AppError('Không tìm thấy người dùng', 404));
  }

  res.json({
    status: 'success',
    message: 'Đã xóa dữ liệu hồ sơ vi phạm thành công'
  });
});

/**
 * GET /admin/vibes/stats
 */
exports.getStats = catchAsync(async (req, res, next) => {
  const [totalVibes, activeVibes, hiddenVibes, pendingVibes] = await Promise.all([
    User.countDocuments({ isProfileComplete: true, role: { $ne: 'admin' } }),
    User.countDocuments({ isProfileComplete: true, role: { $ne: 'admin' }, profileModerationStatus: 'approved' }),
    User.countDocuments({ isProfileComplete: true, role: { $ne: 'admin' }, profileModerationStatus: 'rejected' }),
    User.countDocuments({ isProfileComplete: true, role: { $ne: 'admin' }, profileModerationStatus: 'pending' })
  ]);

  res.json({
    status: 'success',
    data: {
      totalVibes,
      activeVibes,
      hiddenVibes,
      pendingVibes,
      reportedVibes: 0
    }
  });
});
