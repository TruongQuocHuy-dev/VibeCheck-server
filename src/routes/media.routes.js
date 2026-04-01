const express = require('express');
const router = express.Router();
const { uploadMedia } = require('../controllers/media.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * POST /api/media/upload
 * Returns a media URL
 */
router.post('/upload', uploadMedia);

module.exports = router;
