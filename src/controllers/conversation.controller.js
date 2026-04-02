const { Conversation, Message, User } = require('../models');
const { getIO } = require('../config/socket');
const { cloudinary } = require('../config/upload.config');

/**
 * GET /api/conversations
 * Returns chat list for the current user
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find conversations where user is a participant
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'displayName fullName avatar bio isOnline lastActive');

    const result = [];

    const currentUser = await User.findById(userId).select('blockedUsers');
    const myBlockedList = currentUser?.blockedUsers?.map(id => id.toString()) || [];

    for (const conv of conversations) {
      // Robust identification of the other participant
      let otherUser = conv.participants.find(
        (p) => p && p._id && p._id.toString() !== userId.toString()
      );
      
      if (!otherUser && conv.participants.length > 0) {
        otherUser = conv.participants[0];
      }

      // Check block status
      const otherUserFull = otherUser ? await User.findById(otherUser._id).select('blockedUsers') : null;
      const blockedByMe = otherUser ? myBlockedList.includes(otherUser._id.toString()) : false;
      const isBlockedByOther = otherUserFull?.blockedUsers?.some(id => id.toString() === userId.toString()) || false;

      // Find clearedAt for current user
      const clearInfo = conv.clearedBy?.find(c => c.userId.toString() === userId.toString());
      const clearedAt = clearInfo ? clearInfo.clearedAt : new Date(0);

      // Check if there are any messages AFTER clearedAt
      const latestMessage = await Message.findOne({ 
        conversationId: conv._id,
        createdAt: { $gt: clearedAt },
        deletedBy: { $ne: userId }
      }).sort({ createdAt: -1 });

      // If no messages after clearedAt AND no lastMessageAt after clearedAt, hide from list
      // (Unless it's a very new match with no messages yet)
      if (!latestMessage && conv.lastMessageAt && conv.lastMessageAt < clearedAt) {
        continue; 
      }

      // Get unread count from the array (defensive: check if array)
      const unreadCounts = Array.isArray(conv.unreadCounts) ? conv.unreadCounts : [];
      const unreadInfo = unreadCounts.find(u => u.userId?.toString() === userId.toString());
      const unreadCount = unreadInfo ? unreadInfo.count : 0;

      // Check if pinned
      const isPinned = conv.pinnedBy?.some(p => p.toString() === userId.toString()) || false;

      result.push({
        id: conv._id,
        user: otherUser || { displayName: 'Vibe User', fullName: 'Vibe User', avatar: null },
        lastMessage: latestMessage ? latestMessage.content : (conv.lastMessageAt > clearedAt ? conv.lastMessage : ''),
        lastMessageAt: latestMessage ? latestMessage.createdAt : (conv.lastMessageAt || conv.updatedAt),
        unreadCount,
        isPinned,
        blockedByMe,
        isBlockedByOther,
      });
    }

    // Sort: Pinned first, then by lastMessageAt descending
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    return res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    console.error('getConversations error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * GET /api/conversations/:id/messages?page=1&limit=30
 * Returns paginated messages for a conversation
 */
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
    }

    // Get clearedAt for this user
    const clearInfo = conversation.clearedBy?.find(c => c.userId.toString() === userId.toString());
    const clearedAt = clearInfo ? clearInfo.clearedAt : new Date(0);

    const messages = await Message.find({ 
      conversationId,
      createdAt: { $gt: clearedAt },
      deletedBy: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'displayName fullName avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'displayName fullName avatar' }
      });

    // Mark conversation as read logic (defensive: check if array)
    if (!Array.isArray(conversation.unreadCounts)) {
      conversation.unreadCounts = [];
    }
    const unreadIndex = conversation.unreadCounts.findIndex(u => u.userId?.toString() === userId.toString());
    if (unreadIndex > -1 && conversation.unreadCounts[unreadIndex].count > 0) {
      conversation.unreadCounts[unreadIndex].count = 0;
      await conversation.save();
    }

    return res.status(200).json({
      status: 'success',
      data: messages, // Newest first
      meta: { page, limit },
    });
  } catch (error) {
    console.error('getMessages error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/conversations/:id/messages
 * Body: { content, type? }
 * Sends a message and emits via Socket.io
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const { content, type = 'text', replyToId, media, mediaList: rootMediaList } = req.body;
    
    // Support mediaList from root or nested inside media object
    const finalMediaList = Array.isArray(rootMediaList) ? rootMediaList : (Array.isArray(media?.mediaList) ? media.mediaList : []);
    const mediaUrl = media?.uri || req.body.mediaUrl || media?.url;
    
    // Only set mediaType if there's actually media, and ensure it matches the enum
    let mediaType = media?.type || req.body.mediaType;
    if (!['image', 'video', 'audio'].includes(mediaType)) {
      mediaType = (type !== 'text' && ['image', 'video', 'audio'].includes(type)) ? type : undefined;
    }
    
    const publicId = media?.publicId || req.body.publicId;

    console.log('--- SEND MESSAGE DEBUG ---', { 
      content, 
      type, 
      hasMedia: !!media, 
      mediaListCount: finalMediaList.length,
      mediaUri: mediaUrl 
    });

    if (!content && !mediaUrl && finalMediaList.length === 0 && type === 'text') {
      return res.status(400).json({ status: 'fail', message: 'content or media is required.' });
    }

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
    }

    // Check for block status (FB/IG style: cannot message if blocked)
    const otherUserId = conversation.participants.find(p => p.toString() !== userId.toString());
    if (otherUserId) {
      const [currentUser, otherUser] = await Promise.all([
        User.findById(userId).select('blockedUsers'),
        User.findById(otherUserId).select('blockedUsers')
      ]);

      const amIBlocked = otherUser?.blockedUsers?.some(id => id.toString() === userId.toString());
      const didIBlock = currentUser?.blockedUsers?.some(id => id.toString() === otherUserId.toString());

      if (amIBlocked || didIBlock) {
        return res.status(403).json({ 
          status: 'fail', 
          message: 'You cannot send messages to this person.',
          errorCode: 'USER_BLOCKED' 
        });
      }
    }

    // Create message
    const message = await Message.create({
      conversationId,
      sender: userId,
      content,
      type,
      replyTo: replyToId,
      mediaUrl,
      mediaType,
      publicId,
      mediaList: finalMediaList,
      readBy: [userId],
    });

    // Update conversation last message and increment unread for other participants (defensive)
    const otherParticipants = conversation.participants.filter(
      (p) => p.toString() !== userId.toString()
    );

    if (!Array.isArray(conversation.unreadCounts)) {
      conversation.unreadCounts = [];
    }

    for (const pid of otherParticipants) {
      const unreadIndex = conversation.unreadCounts.findIndex(u => u.userId?.toString() === pid.toString());
      if (unreadIndex > -1) {
        conversation.unreadCounts[unreadIndex].count += 1;
      } else {
        conversation.unreadCounts.push({ userId: pid, count: 1 });
      }
    }

    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Populate sender and replyTo before emitting
    await message.populate('sender', 'displayName fullName avatar');
    if (message.replyTo) {
      await message.populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'displayName fullName avatar' }
      });
    }

    // Emit to all in conversation room
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId,
      message,
    });

    // Also push notification/update to all participants in their personal rooms
    const allParticipants = conversation.participants;
    for (const pid of allParticipants) {
      io.to(`user:${pid}`).emit('message_notification', {
        conversationId,
        message,
        sender: { _id: userId },
        preview: content.slice(0, 60),
      });
    }

    return res.status(201).json({ status: 'success', data: message });
  } catch (error) {
    console.error('sendMessage error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/conversations/messages/:messageId/reaction
 * Body: { emoji }
 */
const toggleReaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ status: 'fail', message: 'Emoji is required.' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ status: 'fail', message: 'Message not found.' });
    }

    // Check if user already reacted with this emoji
    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      // Remove reaction
      message.reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    // Emit update via socket
    const io = getIO();
    io.to(`conversation:${message.conversationId}`).emit('reaction_update', {
      messageId: message._id,
      reactions: message.reactions,
    });

    return res.status(200).json({ status: 'success', data: message.reactions });
  } catch (error) {
    console.error('toggleReaction error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/conversations/:id/read
 * Marks all messages in a conversation as read for the current user
 */
const markConversationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
    }

    // Reset unread count for this user (defensive)
    if (!Array.isArray(conversation.unreadCounts)) {
      conversation.unreadCounts = [];
    }
    const unreadIndex = conversation.unreadCounts.findIndex(u => u.userId?.toString() === userId.toString());
    if (unreadIndex > -1) {
      conversation.unreadCounts[unreadIndex].count = 0;
    } else {
      conversation.unreadCounts.push({ userId, count: 0 });
    }
    await conversation.save();

    // Mark messages as read (optional but good for consistency)
    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    return res.status(200).json({ status: 'success', message: 'Conversation marked as read.' });
  } catch (error) {
    console.error('markConversationAsRead error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * PATCH /api/conversations/:id/pin
 * Toggles pin status for the current user
 */
const togglePinConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ status: 'fail', message: 'Conversation not found.' });
    }

    const pinIndex = conversation.pinnedBy.indexOf(userId);
    let isPinned = false;
    if (pinIndex > -1) {
      conversation.pinnedBy.splice(pinIndex, 1);
    } else {
      conversation.pinnedBy.push(userId);
      isPinned = true;
    }

    await conversation.save();

    // Socket emit
    const io = getIO();
    io.to(`user:${userId}`).emit('conversation_pinned', { conversationId, isPinned });

    return res.status(200).json({ status: 'success', data: { isPinned } });
  } catch (error) {
    console.error('togglePinConversation error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * PATCH /api/conversations/:id/unread
 * Marks conversation as unread (count = 1) for the current user
 */
const markAsUnread = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ status: 'fail', message: 'Conversation not found.' });
    }

    // Ensure array (defensive)
    if (!Array.isArray(conversation.unreadCounts)) {
      conversation.unreadCounts = [];
    }
    const unreadIndex = conversation.unreadCounts.findIndex(u => u.userId?.toString() === userId.toString());
    if (unreadIndex > -1) {
      conversation.unreadCounts[unreadIndex].count = 1;
    } else {
      conversation.unreadCounts.push({ userId, count: 1 });
    }

    await conversation.save();

    // Socket emit
    const io = getIO();
    io.to(`user:${userId}`).emit('conversation_unread', { conversationId, unreadCount: 1 });

    return res.status(200).json({ status: 'success', message: 'Conversation marked as unread.' });
  } catch (error) {
    console.error('markAsUnread error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/messages/:messageId?type=me|all
 * Recalls or deletes a message.
 */
const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { type = 'me' } = req.query;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ status: 'fail', message: 'Message not found.' });
    }

    if (type === 'all') {
      // Security: Only sender can recall
      if (message.sender.toString() !== userId.toString()) {
        return res.status(403).json({ status: 'fail', message: 'Only sender can recall this message.' });
      }

      // Security: 2-hour limit
      const twoHours = 2 * 60 * 60 * 1000;
      if (Date.now() - new Date(message.createdAt).getTime() > twoHours) {
        return res.status(400).json({ status: 'fail', message: 'Cannot recall message after 2 hours.' });
      }

      message.isRecalled = {
        status: true,
        by: userId,
        at: new Date(),
      };
      await message.save();

      // Cloudinary deletion logic
      try {
        const publicIdsToDestroy = [];
        // Single media
        if (message.publicId) {
          publicIdsToDestroy.push({
            id: message.publicId,
            resourceType: (message.mediaType === 'audio' || message.mediaType === 'video') ? 'video' : 'image'
          });
        }
        // Multi-media list
        if (Array.isArray(message.mediaList)) {
          message.mediaList.forEach(m => {
            if (m.publicId) {
              publicIdsToDestroy.push({
                id: m.publicId,
                resourceType: (m.mediaType === 'audio' || m.mediaType === 'video') ? 'video' : 'image'
              });
            }
          });
        }

        if (publicIdsToDestroy.length > 0) {
          console.log(`[Cloudinary] Intent to destroy ${publicIdsToDestroy.length} assets:`, publicIdsToDestroy);
          // Destroy all in parallel
          await Promise.all(publicIdsToDestroy.map(asset => 
            cloudinary.uploader.destroy(asset.id, { resource_type: asset.resourceType })
              .catch(err => console.error(`Failed to destroy ${asset.id} (${asset.resourceType}):`, err))
          ));
        }
      } catch (cloudinaryErr) {
        console.error('Cloudinary cleanup error:', cloudinaryErr);
      }

      // Update conversation preview if this was the latest message
      const conversation = await Conversation.findById(message.conversationId);
      if (conversation) {
        const latestMessage = await Message.findOne({ conversationId: message.conversationId })
          .sort({ createdAt: -1 });
        
        console.log(`[Recall] Message recalled: ${message._id}`);
        console.log(`[Recall] Latest message in DB: ${latestMessage?._id}`);

        if (latestMessage && latestMessage._id.toString() === message._id.toString()) {
          console.log(`[Recall] Updating conversation ${conversation._id} lastMessage`);
          conversation.lastMessage = 'Tin nhắn đã được thu hồi';
          await conversation.save();
        }
      }

      const io = getIO();
      console.log(`[Recall] Emitting to conversation:${message.conversationId}`);
      io.to(`conversation:${message.conversationId}`).emit('message_recalled', {
        messageId: message._id,
        conversationId: message.conversationId,
        content: 'Tin nhắn đã được thu hồi',
      });

      if (conversation) {
        console.log(`[Recall] Emitting to ${conversation.participants.length} participants personal rooms`);
        for (const pid of conversation.participants) {
          io.to(`user:${pid}`).emit('message_recalled', {
            messageId: message._id,
            conversationId: message.conversationId,
            content: 'Tin nhắn đã được thu hồi',
          });
        }
      }

      return res.status(200).json({ status: 'success', message: 'Message recalled for everyone.' });
    } else {
      // Delete for me: use $addToSet for performance & consistency
      await Message.updateOne(
        { _id: messageId },
        { $addToSet: { deletedBy: userId } }
      );
      return res.status(200).json({ status: 'success', message: 'Message deleted for you.' });
    }
  } catch (error) {
    console.error('deleteMessage error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/conversations/:id/messages
 * Clears all messages in a conversation for the current user.
 */
const clearConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ status: 'fail', message: 'Conversation not found.' });
    }

    // Update clearedAt in the array
    const clearIndex = conversation.clearedBy.findIndex(c => c.userId.toString() === userId.toString());
    const now = new Date();
    if (clearIndex > -1) {
      conversation.clearedBy[clearIndex].clearedAt = now;
    } else {
      conversation.clearedBy.push({ userId, clearedAt: now });
    }

    // Reset unread count when clearing (defensive)
    if (Array.isArray(conversation.unreadCounts)) {
      const unreadIndex = conversation.unreadCounts.findIndex(u => u.userId?.toString() === userId.toString());
      if (unreadIndex > -1) {
        conversation.unreadCounts[unreadIndex].count = 0;
      }
    }

    await conversation.save();

    // Optionally still mark messages as deletedBy for extra safety/media filtering
    await Message.updateMany(
      { conversationId },
      { $addToSet: { deletedBy: userId } }
    );

    // Socket emit for clearing
    const io = getIO();
    io.to(`user:${userId}`).emit('conversation_cleared', { conversationId, clearedAt: now });

    // Facebook logic: Unpin conversation when deleted
    const pinIndex = conversation.pinnedBy.indexOf(userId);
    if (pinIndex > -1) {
      conversation.pinnedBy.splice(pinIndex, 1);
      await conversation.save();
      // Notify client to update UI (remove pin icon/sorting)
      io.to(`user:${userId}`).emit('conversation_pinned', { conversationId, isPinned: false });
    } else {
      await conversation.save();
    }

    return res.status(200).json({ status: 'success', message: 'Conversation cleared.' });
  } catch (error) {
    console.error('clearConversation error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * GET /api/conversations/:id/media?page=1&limit=20
 * Returns paginated media (images/videos) from a conversation.
 */
const getConversationMedia = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Verify participant (robust check)
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
    }

    const messages = await Message.find({
      conversationId,
      type: { $in: ['image', 'video'] },
      deletedBy: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('mediaUrl mediaType createdAt');

    return res.status(200).json({
      status: 'success',
      data: messages,
      meta: { page, limit }
    });
  } catch (error) {
    console.error('getConversationMedia error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  toggleReaction,
  markConversationAsRead,
  togglePinConversation,
  markAsUnread,
  deleteMessage,
  clearConversation,
  getConversationMedia
};
