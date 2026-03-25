const express = require('express');
const router = express.Router();

const { createVibeStory, getFeed } = require('../controllers/vibe-story.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { upload } = require('../config/upload.config'); // Multer Cloudinary storage

// Require authentication for all vibe story routes
router.use(authenticate);

/**
 * @route   GET /api/vibe-stories/feed
 * @desc    Get match-only feed of vibe stories
 * @access  Private
 */
router.get('/feed', getFeed);

/**
 * @route   POST /api/vibe-stories
 * @desc    Create a new vibe story with image and optional music
 * @access  Private
 */
router.post('/', upload.single('image'), createVibeStory);

module.exports = router;
