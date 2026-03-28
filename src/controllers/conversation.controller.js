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
      .populate('participants', 'displayName fullName avatar bio');

    const result = conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );
      return {
        id: conv._id,
        user: otherUser,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
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
      .populate('sender', 'displayName fullName avatar');

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
      data: messages.reverse(), // return chronological order
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
    const { content, type = 'text' } = req.body;

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

    // Populate sender before emitting
    await message.populate('sender', 'displayName fullName avatar');

    // Emit to all in conversation room
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId,
      message,
    });

    // Also push notification to offline users' personal rooms
    for (const pid of otherParticipants) {
      io.to(`user:${pid}`).emit('message_notification', {
        conversationId,
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

module.exports = { getConversations, getMessages, sendMessage };
