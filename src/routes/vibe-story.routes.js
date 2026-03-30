const express = require('express');
const router = express.Router();

const { createVibeStory, getFeed, deleteVibeStory, replyToVibeStory, getStoryInteractions, reactToVibeStory, recordStoryView } = require('../controllers/vibe-story.controller');
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

/**
 * @route   DELETE /api/vibe-stories/:id
 * @desc    Delete a vibe story (owner only)
 * @access  Private
 */
router.delete('/:id', deleteVibeStory);

/**
 * @route   POST /api/vibe-stories/:id/reply
 * @desc    Reply to a vibe story (creates chat message)
 * @access  Private
 */
router.post('/:id/reply', replyToVibeStory);

/**
 * @route   POST /api/vibe-stories/:id/react
 * @desc    React to a vibe story (silent - no chat message)
 * @access  Private
 */
router.post('/:id/react', reactToVibeStory);

/**
 * @route   POST /api/vibe-stories/:id/view
 * @desc    Record a story view
 * @access  Private
 */
router.post('/:id/view', recordStoryView);

/**
 * @route   GET /api/vibe-stories/:id/interactions
 * @desc    Get story interactions (reactions/replies) - owner only
 * @access  Private
 */
router.get('/:id/interactions', getStoryInteractions);

module.exports = router;
