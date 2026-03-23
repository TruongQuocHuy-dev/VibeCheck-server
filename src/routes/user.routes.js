const express = require('express');
const { getProfile, updateProfile, updateVibes, uploadAvatar } = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { upload } = require('../config/upload.config');

const router = express.Router();

// All routes here are protected
router.use(authenticate);

/**
 * GET /api/users/profile
 * Get current authenticated user's profile details & vibes etc.
 */
router.get('/profile', getProfile);

/**
 * PATCH /api/users/profile
 * Body: { displayName, birthYear }
 */
router.patch('/profile', updateProfile);

/**
 * POST /api/users/vibes
 * Body: { vibes: ['vibe1', 'vibe2'] }
 */
router.post('/vibes', updateVibes);

/**
 * POST /api/users/avatar
 * Multipart/form-data with file key 'avatar'
 */
router.post('/avatar', upload.single('avatar'), uploadAvatar);

module.exports = router;
