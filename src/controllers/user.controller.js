const { User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * PATCH /api/users/profile
 * Update user nickname (displayName) and birthYear.
 * Sets isProfileComplete = true.
 */
const updateProfile = catchAsync(async (req, res, next) => {
  const { displayName, fullName, birthYear } = req.body;
  const userId = req.user?.id;

  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));

  if (!displayName || !birthYear) {
    return next(new AppError('Vui lòng cung cấp biệt danh và năm sinh.', 400));
  }

  const user = await User.findById(userId);
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  user.displayName = displayName;
  if (fullName !== undefined) user.fullName = fullName;
  user.birthYear = Number(birthYear);
  user.isProfileComplete = true; // Profiling complete
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

  const user = await User.findById(id).select(
    'displayName fullName avatar bio vibes birthYear photos isOnline lastActive'
  );
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  return success(res, { user }, 200, 'Lấy hồ sơ thành công.');
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

module.exports = {
  getProfile,
  updateProfile,
  updateVibes,
  uploadAvatar,
  getPublicProfile,
  updateBio,
  addPhoto,
  deletePhoto,
};
