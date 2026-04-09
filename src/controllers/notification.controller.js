const { Notification } = require('../models');
const { getIO } = require('../config/socket');

/**
 * Helper: get and emit unread notification count
 */
const syncUnreadCount = async (userId) => {
  try {
    const unreadCount = await Notification.countDocuments({ owner: userId, isUnread: true });
    const io = getIO();
    io.to(`user:${userId}`).emit('unread_notification_count', { unreadCount });
  } catch (err) {
    console.error('[NotificationService] syncUnreadCount error:', err);
  }
};

/**
 * Helper: create and emit a notification to a user
 */
const createAndEmit = async ({ owner, kind, title, message, avatar = null, metadata = {} }) => {
  try {
    let notification;

    // Aggregation logic for messages: Update existing unread notification if it exists for the same conversation
    if (kind === 'message' && metadata.conversationId) {
      notification = await Notification.findOneAndUpdate(
        { 
          owner, 
          kind: 'message', 
          isUnread: true, 
          'metadata.conversationId': metadata.conversationId 
        },
        { 
          title, 
          message, 
          avatar, 
          metadata,
          createdAt: new Date() // Bring to top
        },
        { new: true }
      );
    }

    if (!notification) {
      notification = await Notification.create({ owner, kind, title, message, avatar, metadata });
    }

    const io = getIO();
    io.to(`user:${owner}`).emit('new_notification', {
      id: notification._id,
      kind,
      title,
      message,
      avatar,
      metadata,
      isUnread: true,
      createdAt: notification.createdAt,
    });

    // Also sync the total unread count
    syncUnreadCount(owner);

    return notification;
  } catch (err) {
    console.error('[NotificationService] createAndEmit error:', err);
  }
};

/**
 * GET /api/notifications?page=1&limit=30
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Notification.find({ owner: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ owner: userId }),
    ]);

    const unreadCount = await Notification.countDocuments({ owner: userId, isUnread: true });

    return res.status(200).json({
      status: 'success',
      data: { items, unreadCount, pagination: { page, limit, total, hasMore: skip + items.length < total } },
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * PATCH /api/notifications/read-all
 */
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ owner: req.user.id, isUnread: true }, { isUnread: false });
    syncUnreadCount(req.user.id);
    return res.status(200).json({ status: 'success', message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
const markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { isUnread: false }
    );
    syncUnreadCount(req.user.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/notifications/:id
 */
const deleteOne = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    syncUnreadCount(req.user.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/notifications
 */
const deleteAll = async (req, res) => {
  try {
    await Notification.deleteMany({ owner: req.user.id });
    syncUnreadCount(req.user.id);
    return res.status(200).json({ status: 'success' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = { syncUnreadCount, createAndEmit, getNotifications, markAllRead, markOneRead, deleteOne, deleteAll };
