const express = require('express');
const router = express.Router();
const { register, checkPhone, setPassword, changePassword, login, googleLogin } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * POST /api/auth/check-phone
 * Checks if a phone number is registered & has password.
 */
router.post('/check-phone', checkPhone);

/**
 * POST /api/auth/register
 * Verify Firebase idToken → upsert User in MongoDB → return app JWT
 */
router.post('/register', register);

/**
 * POST /api/auth/set-password
 * Authenticated new user sets their password after OTP verify
 */
router.post('/set-password', authenticate, setPassword);

/**
 * POST /api/auth/change-password
 * Authenticated user changes their password (requires old password)
 */
router.post('/change-password', authenticate, changePassword);

/**
 * POST /api/auth/login
 * Returning user logs in with phone + password
 */
router.post('/login', login);

/**
 * POST /api/auth/google-login
 * Direct Google Sign-In verification
 */
router.post('/google-login', googleLogin);

module.exports = router;
