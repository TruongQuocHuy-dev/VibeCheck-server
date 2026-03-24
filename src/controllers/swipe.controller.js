const { Swipe, Conversation, User } = require('../models');
const { getIO } = require('../config/socket');

/**
 * POST /api/swipes
 * Body: { swipedId, type: 'like' | 'dislike' }
 */
const createSwipe = async (req, res) => {
  try {
    const swiperId = req.user.id;
    const { swipedId, type } = req.body;

    if (!swipedId || !type) {
      return res.status(400).json({ status: 'fail', message: 'swipedId and type are required.' });
    }

    if (swiperId.toString() === swipedId) {
      return res.status(400).json({ status: 'fail', message: 'Cannot swipe yourself.' });
    }

    // Upsert: update if exists, create if not
    await Swipe.findOneAndUpdate(
      { swiper: swiperId, swiped: swipedId },
      { type },
      { upsert: true, new: true }
    );

    // Check for mutual like
    let matchData = null;
    if (type === 'like') {
      const reverseSwipe = await Swipe.findOne({
        swiper: swipedId,
        swiped: swiperId,
        type: 'like',
      });

      if (reverseSwipe) {
        // It's a MATCH! Create or find existing conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [swiperId, swipedId], $size: 2 },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            participants: [swiperId, swipedId],
            unreadCounts: { [swiperId]: 0, [swipedId]: 0 },
          });
        }

        const swipedUser = await User.findById(swipedId).select('displayName avatar');
        const swiperUser = await User.findById(swiperId).select('displayName avatar');

        matchData = {
          conversationId: conversation._id,
          matchedUser: swipedUser,
        };

        const io = getIO();

        // Notify both users via socket
        io.to(`user:${swipedId}`).emit('new_match', {
          conversationId: conversation._id,
          matchedUser: swiperUser,
        });

        io.to(`user:${swiperId}`).emit('new_match', {
          conversationId: conversation._id,
          matchedUser: swipedUser,
        });
      }
    }

    return res.status(201).json({
      status: 'success',
      data: {
        isMatch: !!matchData,
        match: matchData,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ status: 'fail', message: 'Swipe already recorded.' });
    }
    console.error('createSwipe error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * GET /api/swipes/matches
 * Returns a list of matched users (both swiped each other as 'like')
 */
const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find conversations the user is part of (indicates a match)
    const conversations = await Conversation.find({
      participants: userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'displayName avatar bio vibes');

    const matches = conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );
      return {
        conversationId: conv._id,
        user: otherUser,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCounts?.get(userId.toString()) || 0,
      };
    });

    return res.status(200).json({ status: 'success', data: matches });
  } catch (error) {
    console.error('getMatches error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * GET /api/swipes/candidates
 * Returns users who haven't been swiped by current user yet, filtered by vibes.
 */
const getCandidates = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all users this user already swiped
    const swipes = await Swipe.find({ swiper: userId }).select('swiped');
    const swipedIds = swipes.map((s) => s.swiped);

    // Exclude self and already-swiped users
    const candidates = await User.find({
      _id: { $nin: [...swipedIds, userId] },
      isProfileComplete: true,
    })
      .select('displayName avatar bio vibes birthYear photos')
      .limit(20);

    return res.status(200).json({ status: 'success', data: candidates });
  } catch (error) {
    console.error('getCandidates error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = { createSwipe, getMatches, getCandidates };
