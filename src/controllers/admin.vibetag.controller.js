const { VibeTag, User } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/admin/vibe-tags
 */
exports.getVibeTags = catchAsync(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(req.query.limit || '10', 10)));
  const skip = (page - 1) * limit;
  const { search, colorType, status } = req.query;

  const filter = {};
  if (search) {
    filter.label = { $regex: search, $options: 'i' };
  }
  if (colorType && colorType !== 'all') {
    filter.colorType = colorType;
  }
  if (status === 'active') {
    filter.isActive = { $ne: false };
  } else if (status === 'inactive') {
    filter.isActive = false;
  }

  const [total, tags] = await Promise.all([
    VibeTag.countDocuments(filter),
    VibeTag.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.json({
    status: 'success',
    data: {
      tags,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /api/admin/vibe-tags
 */
exports.createVibeTag = catchAsync(async (req, res, next) => {
  const { label, emoji, colorType } = req.body;

  if (!label || label.trim().length < 2) {
    return next(new AppError('Nhãn phải có ít nhất 2 ký tự', 400));
  }
  if (!emoji) {
    return next(new AppError('Emoji không được để trống', 400));
  }

  // Check duplicate
  const existing = await VibeTag.findOne({ label: label.trim() });
  if (existing) {
    return next(new AppError('Nhãn này đã tồn tại', 409));
  }

  const newTag = await VibeTag.create({
    label: label.trim(),
    emoji,
    colorType: colorType || 'cyan',
  });

  res.status(201).json({
    status: 'success',
    message: 'Đã tạo vibe tag thành công',
    data: newTag,
  });
});

/**
 * PATCH /api/admin/vibe-tags/:id
 */
exports.updateVibeTag = catchAsync(async (req, res, next) => {
  const { label, emoji, colorType, isActive } = req.body;
  const tagId = req.params.id;

  const tag = await VibeTag.findById(tagId);
  if (!tag) {
    return next(new AppError('Không tìm thấy vibe tag', 404));
  }

  if (label && label.trim() !== tag.label) {
    // Check duplicate
    const existing = await VibeTag.findOne({ label: label.trim(), _id: { $ne: tagId } });
    if (existing) {
      return next(new AppError('Nhãn này đã tồn tại', 409));
    }
    tag.label = label.trim();
  }

  if (emoji) tag.emoji = emoji;
  if (colorType) tag.colorType = colorType;
  if (isActive !== undefined) tag.isActive = isActive;

  await tag.save();

  res.json({
    status: 'success',
    message: 'Đã cập nhật vibe tag thành công',
    data: tag,
  });
});

/**
 * DELETE /api/admin/vibe-tags/:id
 */
exports.deleteVibeTag = catchAsync(async (req, res, next) => {
  const tagId = req.params.id;
  const tag = await VibeTag.findById(tagId);

  if (!tag) {
    return next(new AppError('Không tìm thấy vibe tag', 404));
  }

  // Check if tag is used by any user
  // Since User.vibeTags is [String] (labels), we check by label
  const usageCount = await User.countDocuments({ vibeTags: tag.label });

  if (usageCount > 0) {
    // Soft delete if used
    tag.isActive = false;
    await tag.save();
    return res.json({
      status: 'success',
      message: `Nhãn này đang được ${usageCount} người dùng sử dụng. Đã chuyển sang trạng thái nhãn không hoạt động (soft-delete).`,
      data: { softDeleted: true, usageCount },
    });
  }

  // Hard delete if not used
  await VibeTag.findByIdAndDelete(tagId);

  res.json({
    status: 'success',
    message: 'Đã xóa vibe tag thành công',
    data: { hardDeleted: true },
  });
});
