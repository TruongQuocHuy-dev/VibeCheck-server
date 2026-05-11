const Blacklist = require('../models/Blacklist.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * Middleware to check if content contains blacklisted words
 * @param {string[]} fields - Array of field names to check in req.body
 */
const checkBlacklist = (fields = ['caption', 'content', 'text']) => {
  return catchAsync(async (req, res, next) => {
    const activeBlacklist = await Blacklist.find({ isActive: true });
    
    if (activeBlacklist.length === 0) return next();

    const matchedWords = [];
    let isBlocked = false;

    // Helper to check a string against the blacklist
    const checkString = (str) => {
      if (!str || typeof str !== 'string') return;

      for (const item of activeBlacklist) {
        if (item.type === 'exact') {
          if (str.toLowerCase() === item.word.toLowerCase()) {
            matchedWords.push(item.word);
            isBlocked = true;
          }
        } else if (item.type === 'contains') {
          if (str.toLowerCase().includes(item.word.toLowerCase())) {
            matchedWords.push(item.word);
            isBlocked = true;
          }
        } else if (item.type === 'regex') {
          try {
            const regex = new RegExp(item.word, 'i');
            if (regex.test(str)) {
              matchedWords.push(item.word);
              isBlocked = true;
            }
          } catch (e) {
            console.error(`Invalid regex in blacklist: ${item.word}`);
          }
        }
      }
    };

    // Check specified fields
    fields.forEach(field => {
      if (req.body[field]) {
        checkString(req.body[field]);
      }
    });

    if (isBlocked) {
      // Logic: Reject or flag. Here we reject with 400
      return next(
        new AppError(
          `Nội dung chứa từ ngữ không hợp lệ: ${[...new Set(matchedWords)].join(', ')}`,
          400
        )
      );
    }

    next();
  });
};

module.exports = checkBlacklist;
