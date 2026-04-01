const { Conversation, Message } = require('../models');
const { getIO } = require('../config/socket');

/**
 * GET /api/conversations
 * Returns chat list for the current user
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'displayName fullName avatar bio isOnline lastActive');

    const result = conversations.map((conv) => {
      // Robust identification of the other participant
      let otherUser = conv.participants.find(
        (p) => p && p._id && p._id.toString() !== userId.toString()
      );
      
      // Fallback if no other user found (e.g. self-chat or data inconsistency)
      if (!otherUser && conv.participants.length > 0) {
        otherUser = conv.participants[0];
      }

      return {
        id: conv._id,
        user: otherUser || { displayName: 'Vibe User', fullName: 'Vibe User', avatar: null },
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt, // Fallback for new matches
        unreadCount: conv.unreadCounts?.get(userId.toString()) || 0,
      };
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
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'displayName fullName avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'displayName fullName avatar' }
      });

    // Mark messages as read
    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    // Reset unread count for this user
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    );

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
    const { content, type = 'text', replyToId, mediaUrl, mediaType } = req.body;

    if (!content) {
      return res.status(400).json({ status: 'fail', message: 'content is required.' });
    }

    // Verify user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
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
      readBy: [userId],
    });

    // Update conversation last message and increment unread for other participants
    const otherParticipants = conversation.participants.filter(
      (p) => p.toString() !== userId.toString()
    );

    const unreadUpdates = {};
    for (const pid of otherParticipants) {
      const currentCount = conversation.unreadCounts?.get(pid.toString()) || 0;
      unreadUpdates[`unreadCounts.${pid}`] = currentCount + 1;
    }

    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: {
          lastMessage: content,
          lastMessageAt: new Date(),
          ...unreadUpdates,
        },
      }
    );

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
      participants: userId,
    });

    if (!conversation) {
      return res.status(403).json({ status: 'fail', message: 'Access denied.' });
    }

    // Reset unread count for this user
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    );

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

    // Performance: Use updateMany with $addToSet to avoid loops
    await Message.updateMany(
      { conversationId },
      { $addToSet: { deletedBy: userId } }
    );

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

    // Verify participant
    const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
    if (!conversation) {
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
  deleteMessage,
  clearConversation,
  getConversationMedia
};
