const express = require('express');
const { getStats } = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const auditLog = require('../utils/auditLog');

const router = express.Router();

// All admin routes require authentication (and controller checks role)
router.use(authenticate);

/** GET /api/admin/stats */
router.get('/stats', getStats);

/** GET /api/admin/dashboard/activity */
router.get('/dashboard/activity', require('../controllers/admin.controller').getDashboardActivity);

/** GET /api/admin/dashboard/charts */
router.get('/dashboard/charts', require('../controllers/admin.controller').getDashboardCharts);

/** GET /api/admin/users */
router.get('/users', require('../controllers/admin.controller').getUsers);

/** PATCH /api/admin/users/:id */
router.patch('/users/:id', require('../controllers/admin.controller').updateUser);

/** GET /api/admin/analytics */
router.get('/analytics', require('../controllers/admin.controller').getAnalytics);

// Vibe Moderation Routes
const vibeController = require('../controllers/admin.vibe.controller');
router.get('/vibes/moderation', vibeController.getVibesModeration);
router.get('/vibes/stats', vibeController.getStats);
router.patch('/vibes/:id/moderate', auditLog('MODERATE_VIBE', 'Vibe'), vibeController.moderateVibe);
router.delete('/vibes/:id', auditLog('DELETE_VIBE', 'Vibe'), vibeController.deleteVibe);

// Story Moderation Routes
const storyController = require('../controllers/admin.story.controller');
router.get('/stories', storyController.getStories);
router.get('/stories/stats', storyController.getStoryStats);
router.post('/stories/bulk-delete', storyController.bulkDeleteStories);
router.get('/stories/:id', storyController.getStory);
router.patch('/stories/:id/visibility', storyController.hideStory);
router.patch('/stories/:id/extend', storyController.extendStory);
router.delete('/stories/:id', storyController.deleteStory);

// Blacklist Management Routes
const blacklistController = require('../controllers/admin.blacklist.controller');
const { restrictTo } = require('../middlewares/restrictTo.middleware');

router.use('/blacklist', restrictTo('admin', 'moderator'));

router.get('/blacklist', blacklistController.getBlacklist);
router.get('/blacklist/stats', blacklistController.getBlacklistStats);
router.post('/blacklist', auditLog('ADD_BLACKLIST_WORD', 'Blacklist'), blacklistController.addWord);
router.patch('/blacklist/:id', auditLog('UPDATE_BLACKLIST_WORD', 'Blacklist'), blacklistController.updateWord);
router.delete('/blacklist/:id', auditLog('DELETE_BLACKLIST_WORD', 'Blacklist'), blacklistController.deleteWord);

// VibeTag Management Routes
const vibeTagController = require('../controllers/admin.vibetag.controller');
router.get('/vibe-tags', vibeTagController.getVibeTags);
router.post('/vibe-tags', auditLog('CREATE_VIBE_TAG', 'VibeTag'), vibeTagController.createVibeTag);
router.patch('/vibe-tags/:id', auditLog('UPDATE_VIBE_TAG', 'VibeTag'), vibeTagController.updateVibeTag);
router.delete('/vibe-tags/:id', auditLog('DELETE_VIBE_TAG', 'VibeTag'), vibeTagController.deleteVibeTag);

module.exports = router;
