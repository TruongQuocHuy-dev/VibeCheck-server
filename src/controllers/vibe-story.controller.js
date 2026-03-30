const { VibeStory, Conversation } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * POST /api/vibe-stories
 * Create a new Vibe Story (photo + caption + music)
 */
const createVibeStory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { caption, musicStr, locationStr } = req.body;

  if (!req.file && (!caption || caption.trim() === '')) {
    return next(new AppError('Vui lòng chọn ảnh hoặc nhập nội dung để đăng Vibe.', 400));
  }

  let music = null;
  if (musicStr) {
    try {
      music = JSON.parse(musicStr);
    } catch (e) {
      console.warn('Could not parse music payload:', musicStr);
    }
  }

  let location = null;
  if (locationStr) {
    try {
      location = JSON.parse(locationStr);
    } catch (e) {
      console.warn('Could not parse location payload:', locationStr);
    }
  }

  const story = await VibeStory.create({
    author: userId,
    imageUrl: req.file.path, // Cdn url from Cloudinary via multer
    caption: caption || '',
    music,
    location,
  });

  return success(res, { story }, 201, 'Tạo Vibe thành công.');
});

/**
 * GET /api/vibe-stories/feed
 * Get stories from matched users only. Grouped by user, like Instagram.
 */
const getFeed = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // 1. Get all match user IDs from conversations
  const conversations = await Conversation.find({ participants: userId }).select('participants');
  const matchIds = new Set([userId.toString()]); // Always include self
  conversations.forEach((conv) => {
    conv.participants.forEach((pId) => {
      matchIds.add(pId.toString());
    });
  });

  if (matchIds.size === 0) {
    return success(res, { feed: [] }, 200, 'Lấy bảng tin thành công.');
  }

  // 2. Fetch all stories from those specific matched user IDs within the last 24h
  // The DB handles expiration but let's be double sure it works manually by sorting
  const stories = await VibeStory.find({
    author: { $in: Array.from(matchIds) },
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .populate('author', 'displayName fullName avatar isOnline lastActive');

  // 3. Group by user ID
  const feedMap = {};

  stories.forEach((st) => {
    // Check if populate worked
    if (!st.author || !st.author._id) return;
    
    const authorId = st.author._id.toString();
    
    if (!feedMap[authorId]) {
      feedMap[authorId] = {
        user: {
          id: authorId,
          name: st.author.fullName || st.author.displayName || 'Khách',
          avatar: st.author.avatar,
          isOnline: st.author.isOnline,
          lastActive: st.author.lastActive,
        },
        stories: [],
      };
    }
    
    feedMap[authorId].stories.push({
      id: st._id,
      imageUrl: st.imageUrl,
      caption: st.caption,
      music: st.music,
      location: st.location,
      createdAt: st.createdAt,
      expiresAt: st.expiresAt,
    });
  });

  // Convert map back to array
  const feed = Object.values(feedMap);

  // You can sort feed array so active matches with latest stories are first
  feed.sort((a, b) => {
    const aLastStory = a.stories[a.stories.length - 1];
    const bLastStory = b.stories[b.stories.length - 1];
    return bLastStory.createdAt - aLastStory.createdAt;
  });

  return success(res, { feed }, 200, 'Lấy bảng tin thành công.');
});

module.exports = {
  createVibeStory,
  getFeed,
};
