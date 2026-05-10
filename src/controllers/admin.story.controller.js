const { VibeStory, User, StoryView, StoryReaction, Message } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');
const { deleteMedia } = require('../utils/deleteMedia');

/**
 * Helper to format Story response
 */
const formatStoryResponse = (story) => {
  const mediaType = story.imageUrl ? (story.imageUrl.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image') : 'text';
  
  const now = new Date();
  const expiresAt = new Date(story.expiresAt);
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    _id: story._id,
    user: story.author,
    mediaUrl: story.imageUrl,
    mediaType,
    caption: story.caption,
    status: story.status || 'active',
    reportCount: story.reportCount || 0,
    reports: (story.reports || []).map(r => ({
      _id: r._id,
      user: r.reporter,
      reason: r.reason,
      createdAt: r.createdAt
    })),
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    remainingTime: `${remainingHours}h ${remainingMinutes}m`,
    isExpiringSoon: remainingHours < 2,
    location: story.location,
  };
};

/**
 * GET /api/admin/stories
 */
exports.getStories = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const skip = (page - 1) * limit;
  const status = req.query.status || 'all';
  const sortBy = req.query.sortBy || 'createdAt';

  const filter = {};
  if (status !== 'all') {
    if (status === 'reported') {
      filter.reportCount = { $gt: 0 };
    } else if (status === 'expiring-soon') {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      filter.expiresAt = { $lte: soon, $gt: new Date() };
    } else {
      filter.status = status;
    }
  }

  const [total, stories] = await Promise.all([
    VibeStory.countDocuments(filter),
    VibeStory.find(filter)
      .populate('author', '_id fullName displayName avatar email')
      .populate('reports.reporter', '_id fullName displayName avatar')
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(limit)
  ]);

  res.json({
    status: 'success',
    data: {
      stories: stories.map(formatStoryResponse),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

/**
 * GET /api/admin/stories/:id
 */
exports.getStory = catchAsync(async (req, res, next) => {
  const story = await VibeStory.findById(req.params.id)
    .populate('author', '_id fullName displayName avatar email')
    .populate('reports.reporter', '_id fullName displayName avatar');

  if (!story) return next(new AppError('Không tìm thấy story', 404));

  res.json({
    status: 'success',
    data: formatStoryResponse(story)
  });
});

/**
 * DELETE /api/admin/stories/:id
 */
exports.deleteStory = catchAsync(async (req, res, next) => {
  const story = await VibeStory.findById(req.params.id);
  if (!story) return next(new AppError('Không tìm thấy story', 404));

  // Cleanup media
  if (story.imageUrl) {
    await deleteMedia(story.imageUrl);
  }

  // Cascading cleanup
  await Promise.all([
    StoryReaction.deleteMany({ storyId: story._id }),
    StoryView.deleteMany({ storyId: story._id }),
    Message.deleteMany({ 'storyReference.storyId': story._id }),
    VibeStory.deleteOne({ _id: story._id })
  ]);

  if (req.app.get('io')) {
    req.app.get('io').emit('story:deleted', story._id);
  }

  res.json({
    status: 'success',
    message: 'Đã xóa story vĩnh viễn'
  });
});

/**
 * PATCH /api/admin/stories/:id/visibility
 */
exports.hideStory = catchAsync(async (req, res, next) => {
  const vibe = await VibeStory.findByIdAndUpdate(
    req.params.id,
    { status: 'hidden' },
    { new: true }
  );

  if (!vibe) return next(new AppError('Không tìm thấy story', 404));

  if (req.app.get('io')) {
    req.app.get('io').emit('story:hidden', vibe._id);
  }

  res.json({
    status: 'success',
    message: 'Đã ẩn story'
  });
});

/**
 * PATCH /api/admin/stories/:id/extend
 */
exports.extendStory = catchAsync(async (req, res, next) => {
  const story = await VibeStory.findById(req.params.id);
  if (!story) return next(new AppError('Không tìm thấy story', 404));

  const currentExpiresAt = new Date(story.expiresAt);
  const newExpiresAt = new Date(currentExpiresAt.getTime() + 24 * 60 * 60 * 1000); // Add 24h

  // Limit to 48h total from creation
  const maxExpiresAt = new Date(new Date(story.createdAt).getTime() + 48 * 60 * 60 * 1000);
  story.expiresAt = newExpiresAt > maxExpiresAt ? maxExpiresAt : newExpiresAt;
  
  await story.save();

  if (req.app.get('io')) {
    req.app.get('io').emit('story:extended', story._id);
  }

  res.json({
    status: 'success',
    message: 'Đã kéo dài thời gian tồn tại story',
    data: formatStoryResponse(story)
  });
});

/**
 * POST /api/admin/stories/bulk-delete
 */
exports.bulkDeleteStories = catchAsync(async (req, res, next) => {
  const { storyIds } = req.body;
  if (!storyIds || !Array.isArray(storyIds)) return next(new AppError('Invalid storyIds', 400));

  const results = { success: [], failed: [] };

  for (const id of storyIds) {
    try {
      const story = await VibeStory.findById(id);
      if (story) {
        if (story.imageUrl) await deleteMedia(story.imageUrl);
        await Promise.all([
          StoryReaction.deleteMany({ storyId: story._id }),
          StoryView.deleteMany({ storyId: story._id }),
          VibeStory.deleteOne({ _id: story._id })
        ]);
        results.success.push(id);
        if (req.app.get('io')) req.app.get('io').emit('story:deleted', id);
      } else {
        results.failed.push({ id, error: 'Not found' });
      }
    } catch (err) {
      results.failed.push({ id, error: err.message });
    }
  }

  res.json({
    status: 'success',
    data: results
  });
});

/**
 * GET /api/admin/stories/stats
 */
exports.getStoryStats = catchAsync(async (req, res, next) => {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [active, reported, expiringSoon, totalViews] = await Promise.all([
    VibeStory.countDocuments({ status: 'active', expiresAt: { $gt: now } }),
    VibeStory.countDocuments({ reportCount: { $gt: 0 } }),
    VibeStory.countDocuments({ expiresAt: { $lte: soon, $gt: now }, status: 'active' }),
    StoryView.countDocuments({ createdAt: { $gt: new Date(now - 24 * 60 * 60 * 1000) } })
  ]);

  res.json({
    status: 'success',
    data: { active, reported, expiringSoon, totalViews }
  });
});
