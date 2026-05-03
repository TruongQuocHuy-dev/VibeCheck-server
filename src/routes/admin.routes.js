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

module.exports = router;
