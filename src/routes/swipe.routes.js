const express = require('express');
const router = express.Router();
const {
	createSwipe,
	getMatches,
	getCandidates,
	getCandidatesEstimate,
	undoDislike,
	blockUser,
	reportUser,
} = require('../controllers/swipe.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * GET /api/swipes/candidates
 * Get users not yet swiped by current user
 */
router.get('/candidates', getCandidates);
router.get('/candidates/estimate', getCandidatesEstimate);

/**
 * GET /api/swipes/matches
 * Get all matched users (with conversation info)
 */
router.get('/matches', getMatches);

/**
 * DELETE /api/swipes/dislike/:swipedId
 * Undo a dislike swipe
 */
router.delete('/dislike/:swipedId', undoDislike);

/**
 * POST /api/swipes/block
 * Body: { blockedUserId }
 */
router.post('/block', blockUser);

/**
 * POST /api/swipes/report
 * Body: { reportedUserId, reason?, note? }
 */
router.post('/report', reportUser);

/**
 * POST /api/swipes
 * Body: { swipedId, type: 'like' | 'dislike' }
 */
router.post('/', createSwipe);

module.exports = router;
