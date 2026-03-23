const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vibeRoutes = require('./vibe.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vibes', vibeRoutes);

module.exports = router;
