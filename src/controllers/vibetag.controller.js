const { VibeTag } = require('../models');
const catchAsync = require('../utils/catchAsync');

/**
 * GET /api/vibe-tags
 * Mobile app fetch list này để render chip/tag selector
 */
exports.getPublicVibeTags = catchAsync(async (req, res, next) => {
  const tags = await VibeTag.find({ isActive: true })
    .select('_id label emoji colorType')
    .sort({ label: 1 });

  res.json(tags); // Trả về array đơn giản theo yêu cầu mobile
});
