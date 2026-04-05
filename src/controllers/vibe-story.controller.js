const mongoose = require('mongoose');
const { VibeStory, Conversation, Message, StoryReaction, StoryView } = require('../models');
const { getIO } = require('../config/socket');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');
const { cloudinary } = require('../config/upload.config');

/**
 * Helper to get Cloudinary public_id from URL
 */
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  // Example: .../v12345/vibecheck_profiles/publicid.jpg
  // Extract folder + public_id
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return null;

  // After /upload/ is usually vXXXX/folder/public_id.ext
  // Join all parts after the version (which starts with 'v')
  const pathParts = parts.slice(uploadIndex + 2); // skips /upload/ and /vXXXX/
  const fullPath = pathParts.join('/'); // "vibecheck_profiles/publicid.jpg"
  return fullPath.split('.')[0]; // "vibecheck_profiles/publicid"
};

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
    imageUrl: req.file ? req.file.path : null, // Cdn url from Cloudinary via multer OR null for text-only
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

const deleteVibeStory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  const story = await VibeStory.findOne({ _id: id });
  if (!story) {
    return next(new AppError('Không tìm thấy Vibe.', 404));
  }

  if (story.author.toString() !== userId) {
    return next(new AppError('Bạn không có quyền xóa Vibe này.', 403));
  }

  // Delete from Cloudinary if image exists
  if (story.imageUrl) {
    const publicId = getPublicIdFromUrl(story.imageUrl);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error('Cloudinary destroy error:', err);
        // Note: We continue even if Cloudinary fails to keep MongoDB in sync
      }
    }
  }

  // 2. Clear related interaction data (Cascading Cleanup)
  await Promise.all([
    StoryReaction.deleteMany({ storyId: id }),
    StoryView.deleteMany({ storyId: id }),
    VibeStory.deleteOne({ _id: id }),
  ]);

  return success(res, null, 200, 'Xoá Vibe thành công.');
});

const replyToVibeStory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { content } = req.body;

  if (!content) {
    return next(new AppError('Nội dung không được để trống.', 400));
  }

  const story = await VibeStory.findById(id);
  if (!story) {
    return next(new AppError('Vibe này không còn tồn tại.', 404));
  }

  // Không cho phép tự trả lời Vibe của chính mình
  if (story.author.toString() === userId) {
    return next(new AppError('Không thể tự trả lời Vibe của chính mình.', 400));
  }

  // Tìm conversation giữa 2 người
  const conversation = await Conversation.findOne({
    participants: { $all: [userId, story.author] },
  });

  if (!conversation) {
    return next(new AppError('Bạn chưa match với người này, không thể trả lời Vibe.', 403));
  }

  const conversationId = conversation._id;

  // Tạo Message kiểu story_reply
  const message = await Message.create({
    conversationId,
    sender: userId,
    content,
    type: 'story_reply',
    storyReference: {
      storyId: story._id,
      imageUrl: story.imageUrl,
      caption: story.caption,
    },
    readBy: [userId],
  });

  // Cập nhật conversation (defensive: handle array structure)
  if (!Array.isArray(conversation.unreadCounts)) {
    conversation.unreadCounts = [];
  }

  conversation.participants.forEach((pid) => {
    if (pid.toString() !== userId) {
      const unreadIndex = conversation.unreadCounts.findIndex(u => u.userId?.toString() === pid.toString());
      if (unreadIndex > -1) {
        conversation.unreadCounts[unreadIndex].count += 1;
      } else {
        conversation.unreadCounts.push({ userId: pid, count: 1 });
      }
    }
  });

  conversation.lastMessage = content;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  await message.populate('sender', 'displayName fullName avatar');

  // Emit event
  const io = getIO();
  io.to(`conversation:${conversationId}`).emit('new_message', {
    conversationId,
    message,
  });

  // Notification for offline user
  io.to(`user:${story.author.toString()}`).emit('message_notification', {
    conversationId,
    sender: { _id: userId },
    preview: 'Đã trả lời Vibe của bạn: ' + content.slice(0, 30),
  });

  return success(res, { message }, 201, 'Đã gửi trả lời Vibe.');
});

const recordStoryView = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  const story = await VibeStory.findById(id);
  if (!story) {
    return next(new AppError('Vibe này không còn tồn tại.', 404));
  }

  // Đừng tự đếm view chính mình
  if (story.author.toString() === userId) {
    return success(res, null, 200);
  }

  // Upsert view
  await StoryView.findOneAndUpdate(
    { storyId: id, user: userId },
    { storyId: id, user: userId },
    { upsert: true, new: true }
  );

  return success(res, null, 200, 'Đã ghi nhận lượt xem.');
});

const reactToVibeStory = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { content } = req.body; // emoji

  if (!content) {
    return next(new AppError('Biểu cảm không được để trống.', 400));
  }

  const story = await VibeStory.findById(id);
  if (!story) {
    return next(new AppError('Vibe này không còn tồn tại.', 404));
  }

  // Không cho phép tự tương tác chính mình
  if (story.author.toString() === userId) {
    return next(new AppError('Không thể tự thả biểu cảm cho Vibe của chính mình.', 400));
  }

  console.log(`[StoryReaction] Aggregating reaction for story ${id} by user ${userId}`);
  
  // Upsert reaction document with $push for aggregated content
  const reaction = await StoryReaction.findOneAndUpdate(
    { storyId: id, user: userId },
    { $push: { reactions: content } },
    { upsert: true, new: true }
  );

  // Emit event thông báo cho tác giả (vẫn giữ socket để update UI realtime)
  const io = getIO();
  io.to(`user:${story.author.toString()}`).emit('story_interaction', {
    storyId: id,
    type: 'reaction',
    sender: { _id: userId },
    content,
  });

  return success(res, { reaction }, 201, 'Đã thả biểu cảm.');
});

const getStoryInteractions = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  const story = await VibeStory.findById(id);
  if (!story) {
    return next(new AppError('Không tìm thấy Vibe.', 404));
  }

  // Chỉ cho phép chủ sở hữu xem tương tác
  if (story.author.toString() !== userId) {
    return next(new AppError('Bạn không có quyền xem tương tác của Vibe này.', 403));
  }

  const storyObjectId = new mongoose.Types.ObjectId(id);

  // 1. Lấy TẤT CẢ người đã xem Story này
  const viewers = await StoryView.find({ storyId: storyObjectId })
    .populate('user', 'displayName fullName avatar')
    .lean();

  // 2. Lấy tin nhắn trả lời (Replies - Có trong Chat)
  const replies = await Message.find({
    type: 'story_reply',
    'storyReference.storyId': storyObjectId,
  })
    .populate('sender', 'displayName fullName avatar')
    .sort({ createdAt: -1 })
    .lean();

  // 3. Lấy biểu cảm gộp (Reactions - Mảng các emojis)
  const reactions = await StoryReaction.find({
    storyId: storyObjectId,
  })
    .populate('user', 'displayName fullName avatar')
    .lean();

  // 4. Xử lý gộp dữ liệu: Một user chỉ xuất hiện 1 lần
  // Chúng ta sẽ dùng Map để gộp theo User ID
  const userInteractionsMap = new Map();

  // Thêm viewers trước (những người chỉ xem mà không tương tác)
  viewers.forEach(v => {
    userInteractionsMap.set(v.user._id.toString(), {
      sender: v.user,
      latestReply: null,
      reactions: [],
      lastActive: v.createdAt
    });
  });

  // Gộp Reactions
  reactions.forEach(r => {
    const existing = userInteractionsMap.get(r.user._id.toString());
    if (existing) {
      existing.reactions = r.reactions;
      if (new Date(r.updatedAt) > new Date(existing.lastActive)) {
        existing.lastActive = r.updatedAt;
      }
    } else {
      userInteractionsMap.set(r.user._id.toString(), {
        sender: r.user,
        latestReply: null,
        reactions: r.reactions,
        lastActive: r.updatedAt
      });
    }
  });

  // Gộp Replies (lấy cái mới nhất cho mỗi user)
  replies.forEach(rep => {
    const uid = rep.sender._id.toString();
    const existing = userInteractionsMap.get(uid);
    if (existing) {
      if (!existing.latestReply) {
        existing.latestReply = rep.content;
      }
      if (new Date(rep.createdAt) > new Date(existing.lastActive)) {
        existing.lastActive = rep.createdAt;
      }
    } else {
      userInteractionsMap.set(uid, {
        sender: rep.sender,
        latestReply: rep.content,
        reactions: [],
        lastActive: rep.createdAt
      });
    }
  });

  // Chuyển Map thành mảng và sắp xếp theo thời gian hoạt động mới nhất
  const interactions = Array.from(userInteractionsMap.values()).sort((a, b) => 
    new Date(b.lastActive) - new Date(a.lastActive)
  );

  return success(res, { 
    interactions, 
    viewCount: viewers.length,
    interactionCount: interactions.length 
  }, 200, 'Lấy danh sách tương tác thành công.');
});

/**
 * GET /api/vibe-stories/user/:userId
 * Get all stories for a specific user (History)
 */
const getUserStories = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const stories = await VibeStory.find({ author: userId })
    .sort({ createdAt: -1 }) // Newest first
    .populate('author', 'displayName fullName avatar isOnline lastActive');

  return success(res, { stories }, 200, 'Lấy lịch sử Vibe thành công.');
});

module.exports = {
  createVibeStory,
  getFeed,
  getUserStories,
  deleteVibeStory,
  replyToVibeStory,
  reactToVibeStory,
  recordStoryView,
  getStoryInteractions,
};
