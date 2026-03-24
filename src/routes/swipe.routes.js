const express = require('express');
const router = express.Router();
const { createSwipe, getMatches, getCandidates } = require('../controllers/swipe.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * GET /api/swipes/candidates
 * Get users not yet swiped by current user
 */
router.get('/candidates', getCandidates);

/**
 * GET /api/swipes/matches
 * Get all matched users (with conversation info)
 */
router.get('/matches', getMatches);

/**
 * POST /api/swipes
 * Body: { swipedId, type: 'like' | 'dislike' }
 */
router.post('/', createSwipe);

module.exports = router;
