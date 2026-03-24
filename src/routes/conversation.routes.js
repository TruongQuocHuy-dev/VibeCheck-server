const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
} = require('../controllers/conversation.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * GET /api/conversations
 * Get chat list for the current user
 */
router.get('/', getConversations);

/**
 * GET /api/conversations/:id/messages?page=1&limit=30
 * Get paginated messages for a conversation
 */
router.get('/:id/messages', getMessages);

/**
 * POST /api/conversations/:id/messages
 * Body: { content, type? }
 */
router.post('/:id/messages', sendMessage);

module.exports = router;
