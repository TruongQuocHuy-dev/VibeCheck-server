const jwt = require('jsonwebtoken');

const {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRY = '15m',
  REFRESH_TOKEN_EXPIRY = '7d',
} = process.env;

/**
 * Generate an Access Token for an authenticated user.
 */
const generateAccessToken = (userId) => {
  if (!JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not configured.');
  return jwt.sign({ id: userId }, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

/**
 * Generate a Refresh Token for an authenticated user.
 */
const generateRefreshToken = (userId) => {
  if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not configured.');
  return jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

/**
 * Verify and decode an Access Token.
 */
const verifyAccessToken = (token) => {
  if (!JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not configured.');
  return jwt.verify(token, JWT_ACCESS_SECRET);
};

/**
 * Verify and decode a Refresh Token.
 */
const verifyRefreshToken = (token) => {
  if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not configured.');
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
