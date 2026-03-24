const express = require('express');
const router = express.Router();
const {
  getFeed,
  createPost,
  toggleLike,
  addComment,
  deletePost,
} = require('../controllers/post.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

/**
 * GET /api/posts?page=1&limit=10
 */
router.get('/', getFeed);

/**
 * POST /api/posts
 * Body: { content, media?, vibe? }
 */
router.post('/', createPost);

/**
 * POST /api/posts/:id/like
 */
router.post('/:id/like', toggleLike);

/**
 * POST /api/posts/:id/comments
 * Body: { text }
 */
router.post('/:id/comments', addComment);

/**
 * DELETE /api/posts/:id
 */
router.delete('/:id', deletePost);

module.exports = router;
