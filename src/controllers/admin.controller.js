const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const User = require('../models/User.model');
const VibeTag = require('../models/VibeTag.model');
const UserReport = require('../models/UserReport.model');
// AppError already required above

exports.getStats = catchAsync(async (req, res, next) => {
  // Ensure requester is admin
  console.log('ADMIN_STATS: Authorization header=', req.headers.authorization)
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const [usersCount, vibesCount, reportsCount] = await Promise.all([
    User.countDocuments(),
    VibeTag.countDocuments(),
    UserReport.countDocuments(),
  ]);

  res.json({
    status: 'success',
    message: 'Admin stats',
    data: {
      users: usersCount,
      vibes: vibesCount,
      reports: reportsCount,
    },
  });
});

exports.getUsers = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(5, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;
  const search = (req.query.search || '').toString().trim();

  const filter = {}
  if (search) {
    filter.$or = [
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { displayName: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
    ]
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
  ])

  res.json({ status: 'success', message: 'Danh sách users', data: { total, page, limit, users } })
})

exports.updateUser = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const { id } = req.params
  const allowed = ['role', 'displayName', 'fullName']
  const payload = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) payload[key] = req.body[key]
  }

  const updated = await User.findByIdAndUpdate(id, payload, { new: true }).select('-passwordHash')

  if (!updated) {
    return next(new AppError('Không tìm thấy user.', 404))
  }

  res.json({ status: 'success', message: 'User updated', data: { user: updated } })
})
