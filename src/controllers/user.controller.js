const { User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * PATCH /api/users/profile
 * Update user profile: nickname, full name, gender and birthYear.
 * Sets isProfileComplete = true.
 */
const updateProfile = catchAsync(async (req, res, next) => {
  const { displayName, fullName, gender, birthYear } = req.body;
  const userId = req.user?.id;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));

  // Find the user first to prepare for partial update
  const user = await User.findById(userId);
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  // Update only provided fields
  if (displayName !== undefined) user.displayName = displayName;
  if (fullName !== undefined) user.fullName = fullName;
  
  if (gender !== undefined) {
    if (!['male', 'female'].includes(gender)) {
      return next(new AppError('Giới tính không hợp lệ. Chỉ chấp nhận male hoặc female.', 400));
    }
    user.gender = gender;
  }
  
  if (birthYear !== undefined) {
    user.birthYear = Number(birthYear);
  }

  // Ensure overall profile is considered complete if all required fields are now present
  if (user.displayName && user.fullName && user.gender && user.birthYear) {
    user.isProfileComplete = true; 
  }
  
  await user.save();

  return success(res, { user }, 200, 'Cập nhật thông tin hồ sơ thành công.');
});

/**
 * POST /api/users/vibes
 * Save an array of string selected feels to user profile.
 */
const updateVibes = catchAsync(async (req, res, next) => {
  const { vibes } = req.body; // Expect array of string IDs
  const userId = req.user?.id;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));

  if (!Array.isArray(vibes)) {
    return next(new AppError('Vibes phải là một mảng chuỗi.', 400));
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  user.vibes = vibes;
  await user.save();

  return success(res, { vibes: user.vibes }, 200, 'Lưu vibe thành công!');
});

/**
 * POST /api/users/avatar
 * Upload avatar via Multer to Cloudinary, update user.avatar
 */
const uploadAvatar = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));

  if (!req.file) {
    return next(new AppError('Vui lòng cung cấp file ảnh lên.', 400));
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  // req.file.path contains the Cloudinary secure URL
  user.avatar = req.file.path;
  await user.save();

  return success(res, { avatarUrl: user.avatar }, 200, 'Phục vụ ảnh thành công.');
});

/**
 * GET /api/users/profile
 * Get current authenticated user's profile details & vibes etc.
 */
const getProfile = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));

  const user = await User.findById(userId).populate('vibes');
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  return success(res, { user }, 200, 'Lấy thông tin hồ sơ thành công.');
});

/**
 * GET /api/users/:id/profile
 * Returns public-safe profile for another user (for discovery card detail).
 */
const getPublicProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const requesterId = req.user?.id;

  const targetUser = await User.findById(id).select(
    'displayName fullName gender avatar bio vibes birthYear photos isOnline lastActive blockedUsers'
  );
  if (!targetUser) return next(new AppError('Không tìm thấy người dùng.', 404));

  // Check if Target blocked Requester
  const isBlockedByOther = targetUser.blockedUsers?.some(uid => uid.toString() === requesterId.toString());
  if (isBlockedByOther) {
    return next(new AppError('Người dùng này hiện không khả dụng.', 404));
  }

  // Check if Requester blocked Target
  const requester = await User.findById(requesterId).select('blockedUsers');
  const blockedByMe = requester?.blockedUsers?.some(uid => uid.toString() === id.toString());

  if (blockedByMe) {
    // Return only basic info per Meta logic
    const trimmedUser = {
      _id: targetUser._id,
      displayName: targetUser.displayName,
      fullName: targetUser.fullName,
      avatar: targetUser.avatar,
      blockedByMe: true,
    };
    return success(res, { user: trimmedUser }, 200, 'Lấy hồ sơ thành công (Hạn chế).');
  }

  // Regular return
  const userObj = targetUser.toObject();
  delete userObj.blockedUsers;
  userObj.blockedByMe = false;

  return success(res, { user: userObj }, 200, 'Lấy hồ sơ thành công.');
});

/**
 * PATCH /api/users/bio
 * Update user bio text.
 */
const updateBio = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  const { bio } = req.body;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));
  if (typeof bio !== 'string') return next(new AppError('bio phải là chuỗi.', 400));

  const user = await User.findByIdAndUpdate(
    userId,
    { bio: bio.trim() },
    { new: true }
  );
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  return success(res, { bio: user.bio }, 200, 'Cập nhật bio thành công.');
});

/**
 * POST /api/users/photos
 * Upload an extra photo (multer) and push to user.photos array.
 */
const addPhoto = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));
  if (!req.file) return next(new AppError('Vui lòng cung cấp file ảnh.', 400));

  const photoUrl = req.file.path; // Cloudinary URL

  const user = await User.findByIdAndUpdate(
    userId,
    { $push: { photos: photoUrl } },
    { new: true }
  );
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  return success(res, { photos: user.photos }, 200, 'Thêm ảnh thành công.');
});

/**
 * DELETE /api/users/photos
 * Body: { photoUrl: string } — Remove a specific photo from the photos array.
 */
const deletePhoto = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  const { photoUrl } = req.body;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));
  if (!photoUrl) return next(new AppError('photoUrl là bắt buộc.', 400));

  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { photos: photoUrl } },
    { new: true }
  );
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  return success(res, { photos: user.photos }, 200, 'Xóa ảnh thành công.');
});

/**
 * POST /api/users/block
 * Block a user: adds to blockedUsers array, emits socket event.
 * Body: { targetUserId }
 */
const blockUser = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));
  if (!targetUserId) return next(new AppError('targetUserId là bắt buộc.', 400));

  // Simple Rate Limit: Check last block time in session/cache (here simplified)
  // In a real app, use Redis. For now: 
  const user = await User.findById(userId);
  if (!user) return next(new AppError('User not found.', 404));

  // Audit Log
  console.log(`[Audit Log] User ${userId} blocked user ${targetUserId} at ${new Date().toISOString()}`);

  // Update user's blocked list
  await User.findByIdAndUpdate(userId, {
    $addToSet: { blockedUsers: targetUserId }
  });

  // Notify socket
  const { getIO } = require('../config/socket');
  const io = getIO();
  // Blocker update (e.g. to show "You blocked this person")
  io.to(`user:${userId}`).emit('user_blocked', { targetUserId, isBlocked: true, blockedByMe: true });
  // Blocked person update (e.g. to show "This person is unavailable" and hide input)
  io.to(`user:${targetUserId}`).emit('user_blocked', { targetUserId: userId, isBlocked: true, blockedByMe: false });

  return success(res, null, 200, 'Người dùng đã bị chặn.');
});

/**
 * POST /api/users/unblock
 * Body: { targetUserId }
 */
const unblockUser = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));
  if (!targetUserId) return next(new AppError('targetUserId là bắt buộc.', 400));

  await User.findByIdAndUpdate(userId, {
    $pull: { blockedUsers: targetUserId }
  });

  // Notify socket
  const { getIO } = require('../config/socket');
  const io = getIO();
  // Blocker update (e.g. to show "You unblocked this person")
  io.to(`user:${userId}`).emit('user_blocked', { targetUserId, isBlocked: false, blockedByMe: true });
  // Blocked person update (e.g. to show input again)
  io.to(`user:${targetUserId}`).emit('user_blocked', { targetUserId: userId, isBlocked: false, blockedByMe: false });

  return success(res, null, 200, 'Đã bỏ chặn người dùng.');
});

module.exports = {
  getProfile,
  updateProfile,
  updateVibes,
  uploadAvatar,
  getPublicProfile,
  updateBio,
  addPhoto,
  deletePhoto,
  blockUser,
  unblockUser,
};
