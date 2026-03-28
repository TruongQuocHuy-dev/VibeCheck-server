const express = require('express');
const {
  getProfile,
  updateProfile,
  updateVibes,
  uploadAvatar,
  getPublicProfile,
  updateBio,
  addPhoto,
  deletePhoto,
} = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { upload } = require('../config/upload.config');

const router = express.Router();

// All routes here are protected
router.use(authenticate);

/** GET /api/users/profile — Own profile */
router.get('/profile', getProfile);

/** GET /api/users/:id/profile — Public profile (for discovery card detail) */
router.get('/:id/profile', getPublicProfile);

/** PATCH /api/users/profile — Update displayName, fullName, gender, birthYear */
router.patch('/profile', updateProfile);

/** PATCH /api/users/bio — Update bio */
router.patch('/bio', updateBio);

/** POST /api/users/vibes */
router.post('/vibes', updateVibes);

/** POST /api/users/avatar */
router.post('/avatar', upload.single('avatar'), uploadAvatar);

/** POST /api/users/photos — Upload extra photo */
router.post('/photos', upload.single('photo'), addPhoto);

/** DELETE /api/users/photos — Remove extra photo */
router.delete('/photos', deletePhoto);

module.exports = router;

