const express = require('express');
const { getStats } = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// All admin routes require authentication (and controller checks role)
router.use(authenticate);

/** GET /api/admin/stats */
router.get('/stats', getStats);

/** GET /api/admin/users */
router.get('/users', require('../controllers/admin.controller').getUsers);

/** PATCH /api/admin/users/:id */
router.patch('/users/:id', require('../controllers/admin.controller').updateUser);

// Vibe Moderation Routes
const vibeController = require('../controllers/admin.vibe.controller');
router.get('/vibes', vibeController.getVibes);
router.get('/vibes/stats', vibeController.getStats);
router.post('/vibes/bulk-action', vibeController.bulkAction);
router.get('/vibes/:id', vibeController.getVibe);
router.patch('/vibes/:id/hide', vibeController.hideVibe);
router.patch('/vibes/:id/unhide', vibeController.unhideVibe);
router.delete('/vibes/:id', vibeController.deleteVibe);

module.exports = router;
