const express = require('express');
const router = express.Router();
const { chatUpload } = require('../config/upload.config');
const { uploadFile } = require('../controllers/upload.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// POST /api/upload
// Note: 'file' is the field name expected in the multipart/form-data
router.post('/', authenticate, chatUpload.single('file'), uploadFile);

module.exports = router;
