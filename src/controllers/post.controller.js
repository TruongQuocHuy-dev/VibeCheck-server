const { Post } = require('../models');

/**
 * GET /api/posts?page=1&limit=10
 * Returns feed of posts (all users, ordered by newest)
 */
const getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'displayName fullName avatar vibes')
      .populate('comments.user', 'displayName fullName avatar');

    const total = await Post.countDocuments();

    return res.status(200).json({
      status: 'success',
      data: posts,
      meta: { page, limit, total },
    });
  } catch (error) {
    console.error('getFeed error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/posts
 * Body: { content, media?, vibe? }
 * Create a new post
 */
const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, media, vibe } = req.body;

    if (!content) {
      return res.status(400).json({ status: 'fail', message: 'content is required.' });
    }

    const post = await Post.create({ user: userId, content, media, vibe });
    await post.populate('user', 'displayName fullName avatar vibes');

    return res.status(201).json({ status: 'success', data: post });
  } catch (error) {
    console.error('createPost error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/posts/:id/like
 * Toggle like on a post
 */
const toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ status: 'fail', message: 'Post not found.' });

    const alreadyLiked = post.likes.some((uid) => uid.toString() === userId.toString());

    if (alreadyLiked) {
      post.likes = post.likes.filter((uid) => uid.toString() !== userId.toString());
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return res.status(200).json({
      status: 'success',
      data: { liked: !alreadyLiked, likesCount: post.likes.length },
    });
  } catch (error) {
    console.error('toggleLike error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * POST /api/posts/:id/comments
 * Body: { text }
 * Add a comment to a post
 */
const addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { text } = req.body;

    if (!text) return res.status(400).json({ status: 'fail', message: 'text is required.' });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ status: 'fail', message: 'Post not found.' });

    post.comments.push({ user: userId, text });
    await post.save();

    // Return the last added comment populated
    await post.populate('comments.user', 'displayName fullName avatar');
    const newComment = post.comments[post.comments.length - 1];

    return res.status(201).json({ status: 'success', data: newComment });
  } catch (error) {
    console.error('addComment error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

/**
 * DELETE /api/posts/:id
 * Delete a post (only by owner)
 */
const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const post = await Post.findOneAndDelete({ _id: id, user: userId });
    if (!post) return res.status(404).json({ status: 'fail', message: 'Post not found or not authorized.' });

    return res.status(200).json({ status: 'success', message: 'Post deleted.' });
  } catch (error) {
    console.error('deletePost error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

module.exports = { getFeed, createPost, toggleLike, addComment, deletePost };
