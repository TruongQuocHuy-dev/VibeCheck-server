const express = require('express');
const router = express.Router();
const { deleteMessage } = require('../controllers/conversation.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * DELETE /api/messages/:messageId?type=me|all
 * Recall or delete a message
 */
router.delete('/:messageId', deleteMessage);

module.exports = router;
