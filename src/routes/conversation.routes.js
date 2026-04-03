const express = require('express');
const router = express.Router();
const {
  getConversations,
  getMessages,
  sendMessage,
  toggleReaction,
  markConversationAsRead,
  togglePinConversation,
  markAsUnread,
  clearConversation,
  getConversationMedia,
  markAsDelivered,
} = require('../controllers/conversation.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * GET /api/conversations
 * Get chat list for the current user
 */
router.get('/', getConversations);

/**
 * PATCH /api/conversations/:id/pin
 * Toggle pin status for the current user
 */
router.patch('/:id/pin', togglePinConversation);

/**
 * PATCH /api/conversations/:id/unread
 * Mark conversation as unread for the current user
 */
router.patch('/:id/unread', markAsUnread);

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

router.delete('/:id/messages', clearConversation);

/**
 * POST /api/conversations/messages/:id/delivered
 * Mark message as delivered
 */
router.post('/messages/:id/delivered', markAsDelivered);

/**
 * GET /api/conversations/:id/media
 * Get media gallery for conversation
 */
router.get('/:id/media', getConversationMedia);

module.exports = router;
