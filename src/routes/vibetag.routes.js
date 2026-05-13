const express = require('express');
const vibeTagController = require('../controllers/vibetag.controller');

const router = express.Router();

router.get('/', vibeTagController.getPublicVibeTags);

module.exports = router;
