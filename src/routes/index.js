const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vibeRoutes = require('./vibe.routes');
const adminRoutes = require('./admin.routes');
const swipeRoutes = require('./swipe.routes');
const conversationRoutes = require('./conversation.routes');
const vibeStoryRoutes = require('./vibe-story.routes');
const mediaRoutes = require('./media.routes');
const messageRoutes = require('./message.routes');
const notificationRoutes = require('./notification.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vibes', vibeRoutes);
router.use('/admin', adminRoutes);
router.use('/swipes', swipeRoutes);
router.use('/conversations', conversationRoutes);
router.use('/vibe-stories', vibeStoryRoutes);
router.use('/media', mediaRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;

