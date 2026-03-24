const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vibeRoutes = require('./vibe.routes');
const swipeRoutes = require('./swipe.routes');
const conversationRoutes = require('./conversation.routes');
const postRoutes = require('./post.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vibes', vibeRoutes);
router.use('/swipes', swipeRoutes);
router.use('/conversations', conversationRoutes);
router.use('/posts', postRoutes);

module.exports = router;

