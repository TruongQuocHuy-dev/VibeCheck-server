const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  toggleReaction,
  markConversationAsRead,
  clearConversation,
  getConversationMedia,
} = require('../controllers/conversation.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * GET /api/conversations
 * Get chat list for the current user
 */
router.get('/', getConversations);

/**
 * POST /api/conversations/:id/read
 * Mark conversation as read for the current user
 */
router.post('/:id/read', markConversationAsRead);

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

router.post('/messages/:messageId/reaction', toggleReaction);

/**
 * DELETE /api/conversations/:id/messages
 * Clear all messages in conversation
 */
router.delete('/:id/messages', clearConversation);

/**
 * GET /api/conversations/:id/media
 * Get media gallery for conversation
 */
router.get('/:id/media', getConversationMedia);

module.exports = router;
