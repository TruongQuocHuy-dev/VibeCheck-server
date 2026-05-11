const Blacklist = require('../models/Blacklist.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');

/**
 * Validate regex to prevent simple ReDoS
 */
const isValidRegex = (str) => {
  try {
    new RegExp(str);
    // Simple check for dangerous patterns like (a+)+ or (a|b)*
    const dangerousPatterns = [
      /\(\.?\*?\+?\)\*/,
      /\(\.?\*?\+?\)\+/,
      /\[.*\]\*/,
      /\[.*\]\+/,
    ];
    // This is very basic, a real production app would use safe-regex or similar
    return !dangerousPatterns.some(p => p.test(str));
  } catch (e) {
    return false;
  }
};

/**
 * GET /api/admin/blacklist
 */
exports.getBlacklist = catchAsync(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(req.query.limit || '10', 10)));
  const skip = (page - 1) * limit;
  const { search, type, status } = req.query;

  const filter = {};
  if (search) {
    filter.word = { $regex: search, $options: 'i' };
  }
  if (type && type !== 'all') {
    filter.type = type;
  }
  if (status && status !== 'all') {
    filter.isActive = status === 'active';
  }

  const [total, words] = await Promise.all([
    Blacklist.countDocuments(filter),
    Blacklist.find(filter)
      .populate('createdBy', 'fullName displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.json({
    status: 'success',
    data: {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /api/admin/blacklist
 */
exports.addWord = catchAsync(async (req, res, next) => {
  const { word, type, isActive } = req.body;

  if (!word || word.trim().length < 2) {
    return next(new AppError('Từ khóa phải có ít nhất 2 ký tự', 400));
  }

  // Check for duplicate
  const existing = await Blacklist.findOne({ word: word.toLowerCase().trim() });
  if (existing) {
    return next(new AppError('Từ khóa này đã tồn tại trong danh sách', 409));
  }

  // Validate Regex
  if (type === 'regex' && !isValidRegex(word)) {
    return next(new AppError('Regex không hợp lệ hoặc quá phức tạp (có nguy cơ ReDoS)', 400));
  }

  const newWord = await Blacklist.create({
    word,
    type: type || 'contains',
    isActive: isActive !== undefined ? isActive : true,
    createdBy: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    message: 'Đã thêm từ khóa vào blacklist thành công',
    data: newWord,
  });
});

/**
 * PATCH /api/admin/blacklist/:id
 */
exports.updateWord = catchAsync(async (req, res, next) => {
  const { word, type, isActive } = req.body;
  const wordId = req.params.id;

  const blacklistWord = await Blacklist.findById(wordId);
  if (!blacklistWord) {
    return next(new AppError('Không tìm thấy từ khóa', 404));
  }

  if (word) {
    // Check duplicate if word is changed
    const existing = await Blacklist.findOne({ 
      word: word.toLowerCase().trim(), 
      _id: { $ne: wordId } 
    });
    if (existing) {
      return next(new AppError('Từ khóa này đã tồn tại trong danh sách', 409));
    }
    blacklistWord.word = word;
  }

  if (type) {
    if (type === 'regex' && !isValidRegex(word || blacklistWord.word)) {
      return next(new AppError('Regex không hợp lệ hoặc quá phức tạp', 400));
    }
    blacklistWord.type = type;
  }

  if (isActive !== undefined) {
    blacklistWord.isActive = isActive;
  }

  await blacklistWord.save();

  res.json({
    status: 'success',
    message: 'Đã cập nhật từ khóa thành công',
    data: blacklistWord,
  });
});

/**
 * DELETE /api/admin/blacklist/:id
 */
exports.deleteWord = catchAsync(async (req, res, next) => {
  const blacklistWord = await Blacklist.findByIdAndDelete(req.params.id);

  if (!blacklistWord) {
    return next(new AppError('Không tìm thấy từ khóa', 404));
  }

  res.json({
    status: 'success',
    message: 'Đã xóa từ khóa khỏi blacklist',
  });
});

/**
 * GET /api/admin/blacklist/stats
 */
exports.getBlacklistStats = catchAsync(async (req, res, next) => {
  const stats = await Blacklist.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        exact: { $sum: { $cond: [{ $eq: ['$type', 'exact'] }, 1, 0] } },
        contains: { $sum: { $cond: [{ $eq: ['$type', 'contains'] }, 1, 0] } },
        regex: { $sum: { $cond: [{ $eq: ['$type', 'regex'] }, 1, 0] } },
      },
    },
  ]);

  const defaultStats = {
    total: 0,
    active: 0,
    inactive: 0,
    exact: 0,
    contains: 0,
    regex: 0,
  };

  res.json({
    status: 'success',
    data: stats.length > 0 ? stats[0] : defaultStats,
  });
});
