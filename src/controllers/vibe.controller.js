const { VibeTag } = require('../models');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/vibes
 * Fetch all loaded vibe tags for app rendering.
 */
const getVibes = catchAsync(async (req, res, next) => {
  const vibes = await VibeTag.find();
  return success(res, { vibes }, 200, 'Lấy danh sách vibe thành công.');
});

module.exports = { getVibes };
