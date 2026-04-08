const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteOne,
  deleteAll,
} = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markOneRead);
router.delete('/', deleteAll);
router.delete('/:id', deleteOne);

module.exports = router;
