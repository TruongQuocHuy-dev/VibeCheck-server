const { Swipe, Conversation, User, UserReport } = require('../models');
const { getIO } = require('../config/socket');

const getAgeFiltersFromQuery = (query) => {
  const minAgeParam = Number(query.minAge);
  const maxAgeParam = Number(query.maxAge);

  const minAge = Number.isFinite(minAgeParam) && minAgeParam >= 18 ? minAgeParam : 18;
  const maxAgeRaw = Number.isFinite(maxAgeParam) && maxAgeParam >= minAge ? maxAgeParam : 40;
  const maxAge = Math.max(minAge, maxAgeRaw);

  return { minAge, maxAge };
};

/**
 * POST /api/swipes
 * Body: { swipedId, type: 'like' | 'dislike' }
 */
const createSwipe = async (req, res) => {
  try {
    const swiperId = req.user.id;
    const { swipedId, type } = req.body;
    let emitPayload = null;

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
      })
        .select('_id')
        .lean();

      if (reverseSwipe) {
        // It's a MATCH! Create or find existing conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [swiperId, swipedId], $size: 2 },
        })
          .select('_id')
          .lean();

        if (!conversation) {
          const createdConversation = await Conversation.create({
            participants: [swiperId, swipedId],
            unreadCounts: [
              { userId: swiperId, count: 0 },
              { userId: swipedId, count: 0 }
            ],
          });
          conversation = { _id: createdConversation._id };
        }

        const [swipedUser, swiperUser] = await Promise.all([
          User.findById(swipedId).select('fullName displayName avatar').lean(),
          User.findById(swiperId).select('fullName displayName avatar').lean(),
        ]);

        matchData = {
          conversationId: conversation._id,
          matchedUser: swipedUser,
        };

        emitPayload = {
          swipedId,
          swiperId,
          conversationId: conversation._id,
          swipedUser,
          swiperUser,
        };
      }
    }

    res.status(201).json({
      status: 'success',
      data: {
        isMatch: !!matchData,
        match: matchData,
      },
    });

    if (emitPayload) {
      setImmediate(() => {
        try {
          const io = getIO();
          io.to(`user:${emitPayload.swipedId}`).emit('new_match', {
            conversationId: emitPayload.conversationId,
            matchedUser: emitPayload.swiperUser,
          });

          io.to(`user:${emitPayload.swiperId}`).emit('new_match', {
            conversationId: emitPayload.conversationId,
            matchedUser: emitPayload.swipedUser,
          });
        } catch (socketErr) {
          console.error('new_match emit error:', socketErr);
        }
      });
    }

    return;
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
      .populate('participants', 'fullName displayName avatar bio vibes isOnline lastActive');

    const [currentUser, usersBlockedMe] = await Promise.all([
      User.findById(userId).select('blockedUsers').lean(),
      User.find({ blockedUsers: userId }).select('_id').lean(),
    ]);

    const blockedByMeIds = (currentUser?.blockedUsers || []).map((id) => id.toString());
    const blockedMeIds = usersBlockedMe.map((user) => user._id.toString());
    const blockedSet = new Set([...blockedByMeIds, ...blockedMeIds]);

    const matches = conversations
      .map((conv) => {
        const otherUser = conv.participants.find(
          (p) => p && p._id && p._id.toString() !== userId.toString()
        );
        
        if (!otherUser) return null;
        if (blockedSet.has(otherUser._id.toString())) return null;

        // Get unread count from the array (defensive: check if array)
        const counts = Array.isArray(conv.unreadCounts) ? conv.unreadCounts : [];
        const unreadInfo = counts.find(u => u.userId?.toString() === userId.toString());
        const unreadCount = unreadInfo ? unreadInfo.count : 0;

        return {
          conversationId: conv._id,
          user: otherUser,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
        };
      })
      .filter(Boolean);

    return res.status(200).json({ status: 'success', data: matches });
  } catch (error) {
    console.error('getMatches error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * GET /api/swipes/candidates
 * Returns candidates filtered by age/gender.
 * Disliked cards reappear after 7 days, max 5 recycled cards per request.
 */
const getCandidates = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { minAge, maxAge } = getAgeFiltersFromQuery(req.query);
    const filterGender = req.query.gender;

    const currentYear = now.getFullYear();
    const maxBirthYear = currentYear - minAge;
    const minBirthYear = currentYear - maxAge;

    const baseUserFilter = {
      isProfileComplete: true,
      _id: { $ne: userId },
      birthYear: { $lte: maxBirthYear, $gte: minBirthYear },
    };

    if (filterGender === 'male' || filterGender === 'female') {
      baseUserFilter.gender = filterGender;
    }

    const [currentUser, usersBlockedMe] = await Promise.all([
      User.findById(userId).select('blockedUsers').lean(),
      User.find({ blockedUsers: userId }).select('_id').lean(),
    ]);

    const blockedByMeIds = (currentUser?.blockedUsers || []).map((id) => id.toString());
    const blockedMeIds = usersBlockedMe.map((user) => user._id.toString());
    const blockedSet = new Set([...blockedByMeIds, ...blockedMeIds]);

    // Get all users this user already swiped
    const swipes = await Swipe.find({ swiper: userId }).select('swiped type updatedAt').lean();

    const likedIds = [];
    const recentDislikedIds = [];
    const recyclableDislikedIds = [];

    swipes.forEach((swipe) => {
      const id = swipe.swiped?.toString();
      if (!id) return;
      if (blockedSet.has(id)) return;

      if (swipe.type === 'like') {
        likedIds.push(id);
        return;
      }

      if (swipe.type === 'dislike') {
        const updatedAt = swipe.updatedAt ? new Date(swipe.updatedAt) : null;
        if (updatedAt && updatedAt <= oneWeekAgo) {
          recyclableDislikedIds.push(id);
        } else {
          recentDislikedIds.push(id);
        }
      }
    });

    const freshExcludedIds = [
      ...likedIds,
      ...recentDislikedIds,
      ...recyclableDislikedIds,
      ...blockedByMeIds,
      ...blockedMeIds,
      userId.toString(),
    ];

    const recycledLimit = 5;
    const freshLimit = 20 - recycledLimit;

    const freshCandidates = await User.find({
      ...baseUserFilter,
      _id: { $nin: freshExcludedIds },
    })
      .select('fullName displayName gender avatar bio vibes birthYear photos')
      .lean()
      .limit(freshLimit);

    const recycledCandidates = recyclableDislikedIds.length
      ? await User.find({
          ...baseUserFilter,
          _id: { $in: recyclableDislikedIds },
        })
          .select('fullName displayName gender avatar bio vibes birthYear photos')
          .lean()
          .limit(recycledLimit)
      : [];

    const candidates = [...freshCandidates, ...recycledCandidates].slice(0, 20);

    const candidateIds = candidates.map((c) => c._id);

    const reverseLikes = await Swipe.find({
      swiper: { $in: candidateIds },
      swiped: userId,
      type: 'like',
    })
      .select('swiper')
      .lean();

    const likedMeSet = new Set(reverseLikes.map((item) => item.swiper.toString()));

    const enrichedCandidates = candidates.map((candidate) => ({
      ...candidate,
      hasLikedMe: likedMeSet.has(candidate._id.toString()),
    }));

    return res.status(200).json({ status: 'success', data: enrichedCandidates });
  } catch (error) {
    console.error('getCandidates error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * GET /api/swipes/candidates/estimate
 * Returns estimated number of available candidates for current filters.
 */
const getCandidatesEstimate = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { minAge, maxAge } = getAgeFiltersFromQuery(req.query);
    const filterGender = req.query.gender;

    const currentYear = now.getFullYear();
    const maxBirthYear = currentYear - minAge;
    const minBirthYear = currentYear - maxAge;

    const baseUserFilter = {
      isProfileComplete: true,
      _id: { $ne: userId },
      birthYear: { $lte: maxBirthYear, $gte: minBirthYear },
    };

    if (filterGender === 'male' || filterGender === 'female') {
      baseUserFilter.gender = filterGender;
    }

    const [currentUser, usersBlockedMe, swipes] = await Promise.all([
      User.findById(userId).select('blockedUsers').lean(),
      User.find({ blockedUsers: userId }).select('_id').lean(),
      Swipe.find({ swiper: userId }).select('swiped type updatedAt').lean(),
    ]);

    const blockedByMeIds = (currentUser?.blockedUsers || []).map((id) => id.toString());
    const blockedMeIds = usersBlockedMe.map((user) => user._id.toString());

    const likedIds = [];
    const recentDislikedIds = [];

    swipes.forEach((swipe) => {
      const id = swipe.swiped?.toString();
      if (!id) return;

      if (swipe.type === 'like') {
        likedIds.push(id);
        return;
      }

      if (swipe.type === 'dislike') {
        const updatedAt = swipe.updatedAt ? new Date(swipe.updatedAt) : null;
        if (!updatedAt || updatedAt > oneWeekAgo) {
          recentDislikedIds.push(id);
        }
      }
    });

    const excludeIds = [
      ...likedIds,
      ...recentDislikedIds,
      ...blockedByMeIds,
      ...blockedMeIds,
      userId.toString(),
    ];

    const estimatedCount = await User.countDocuments({
      ...baseUserFilter,
      _id: { $nin: excludeIds },
    });

    return res.status(200).json({ status: 'success', data: { estimatedCount } });
  } catch (error) {
    console.error('getCandidatesEstimate error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/swipes/dislike/:swipedId
 * Undo latest dislike for a candidate.
 */
const undoDislike = async (req, res) => {
  try {
    const swiperId = req.user.id;
    const { swipedId } = req.params;

    if (!swipedId) {
      return res.status(400).json({ status: 'fail', message: 'swipedId is required.' });
    }

    const deleted = await Swipe.findOneAndDelete({
      swiper: swiperId,
      swiped: swipedId,
      type: 'dislike',
    });

    if (!deleted) {
      return res.status(404).json({ status: 'fail', message: 'No dislike swipe to undo.' });
    }

    return res.status(200).json({ status: 'success', data: { undone: true } });
  } catch (error) {
    console.error('undoDislike error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/swipes/block
 * Body: { blockedUserId }
 */
const blockUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ status: 'fail', message: 'blockedUserId is required.' });
    }

    if (userId.toString() === blockedUserId.toString()) {
      return res.status(400).json({ status: 'fail', message: 'Cannot block yourself.' });
    }

    await User.updateOne(
      { _id: userId },
      { $addToSet: { blockedUsers: blockedUserId } }
    );

    // Ensure the blocked user also disappears immediately from feed behavior.
    await Swipe.findOneAndUpdate(
      { swiper: userId, swiped: blockedUserId },
      { type: 'dislike' },
      { upsert: true, new: true }
    );

    return res.status(200).json({ status: 'success', data: { blocked: true } });
  } catch (error) {
    console.error('blockUser error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/swipes/report
 * Body: { reportedUserId, reason?, note? }
 */
const reportUser = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { reportedUserId, reason, note } = req.body;

    if (!reportedUserId) {
      return res.status(400).json({ status: 'fail', message: 'reportedUserId is required.' });
    }

    if (reporterId.toString() === reportedUserId.toString()) {
      return res.status(400).json({ status: 'fail', message: 'Cannot report yourself.' });
    }

    await UserReport.create({
      reporter: reporterId,
      reportedUser: reportedUserId,
      reason: reason || 'other',
      note: note || null,
    });

    return res.status(201).json({ status: 'success', data: { reported: true } });
  } catch (error) {
    console.error('reportUser error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = {
  createSwipe,
  getMatches,
  getCandidates,
  getCandidatesEstimate,
  undoDislike,
  blockUser,
  reportUser,
};
