const express = require('express');
const router = express.Router();
const vibeController = require('../controllers/vibe.controller');

// Public or Protected: Usually public for onboarding
router.get('/', vibeController.getVibes);

module.exports = router;
