const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { 
  User, 
  VibeTag, 
  UserReport, 
  VibeStory, 
  AuditLog 
} = require('../models');

exports.getStats = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [
    totalUsers, 
    totalUsersSevenDaysAgo,
    activeNow, 
    pendingReports, 
    pendingProfiles,
    pendingStories
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: 'admin' } }),
    User.countDocuments({ role: { $ne: 'admin' }, createdAt: { $lte: sevenDaysAgo } }),
    User.countDocuments({ role: { $ne: 'admin' }, isOnline: true }),
    UserReport.countDocuments({ status: 'pending' }),
    User.countDocuments({ role: { $ne: 'admin' }, isProfileComplete: true, profileModerationStatus: 'pending' }),
    VibeStory.countDocuments({ status: 'pending' })
  ]);

  const totalUsersTrend = totalUsersSevenDaysAgo === 0 
    ? 0 
    : parseFloat(((totalUsers - totalUsersSevenDaysAgo) / totalUsersSevenDaysAgo * 100).toFixed(1));

  res.json({
    status: 'success',
    data: {
      totalUsers,
      totalUsersTrend,
      activeNow,
      pendingReports,
      pendingContent: pendingProfiles + pendingStories
    },
  });
});

exports.getDashboardActivity = catchAsync(async (req, res, next) => {
  const activities = await AuditLog.find()
    .populate('adminId', 'fullName displayName email avatar')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const formattedActivities = activities.map(act => ({
    id: act._id,
    timestamp: act.createdAt,
    type: 'admin_action',
    user: act.adminId?.fullName || act.adminId?.displayName || 'Admin',
    action: act.action,
    status: 'completed'
  }));

  res.json({
    status: 'success',
    data: formattedActivities
  });
});

exports.getDashboardCharts = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 1. User Growth (Last 7 days)
  const userGrowth = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(today.getDate() - i);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const count = await User.countDocuments({ 
      role: { $ne: 'admin' },
      createdAt: { $gte: start, $lt: end }
    });

    userGrowth.push({
      name: start.toLocaleDateString('vi-VN', { weekday: 'short' }),
      users: count
    });
  }

  // 2. Content Distribution
  const [activeStories, hiddenStories, pendingStories] = await Promise.all([
    VibeStory.countDocuments({ status: 'active' }),
    VibeStory.countDocuments({ status: 'hidden' }),
    VibeStory.countDocuments({ status: 'pending' })
  ]);

  const contentStatus = [
    { name: 'Active', value: activeStories },
    { name: 'Hidden', value: hiddenStories },
    { name: 'Reported', value: pendingStories } // Using pending as a proxy for reported/under-review
  ];

  // 3. Reports By Type
  const reports = await UserReport.aggregate([
    { $group: { _id: '$reason', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 4 }
  ]);

  const reportsByType = reports.map(r => ({
    name: r._id || 'Khác',
    count: r.count
  }));

  res.json({
    status: 'success',
    data: {
      userGrowth,
      contentStatus,
      reportsByType
    }
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
  const andConditions = []

  if (search) {
    andConditions.push({
      $or: [
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
      ]
    })
  }
  
  if (req.query.status && req.query.status !== 'all') {
    if (req.query.status === 'active') {
      andConditions.push({
        $or: [
          { status: 'active' },
          { status: { $exists: false } }
        ]
      })
    } else {
      andConditions.push({ status: req.query.status })
    }
  }

  if (req.query.role) {
    if (req.query.role === 'user') {
      andConditions.push({
        $or: [
          { role: 'user' },
          { role: { $exists: false } }
        ]
      })
    } else if (req.query.role.includes('|')) {
      filter.role = { $in: req.query.role.split('|') }
    } else {
      filter.role = req.query.role
    }
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
  ])

  res.json({ 
    status: 'success', 
    message: 'Danh sách users', 
    data: { 
      total, 
      page, 
      limit, 
      totalPages: Math.ceil(total / limit),
      users 
    } 
  })
})

exports.getAnalytics = catchAsync(async (req, res, next) => {
  const { from, to, granularity = 'day' } = req.query;
  const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to) : new Date();

  // Basic counts
  const [totalNewUsers, totalReports, activeNow] = await Promise.all([
    User.countDocuments({ role: { $ne: 'admin' }, createdAt: { $gte: startDate, $lte: endDate } }),
    UserReport.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
    User.countDocuments({ role: { $ne: 'admin' }, isOnline: true })
  ]);

  // Growth Chart Data
  const growth = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const start = new Date(current);
    const end = new Date(current);
    if (granularity === 'day') {
      end.setDate(end.getDate() + 1);
    } else if (granularity === 'week') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    const count = await User.countDocuments({
      role: { $ne: 'admin' },
      createdAt: { $gte: start, $lt: end }
    });

    growth.push({
      date: start.toISOString().split('T')[0],
      users: count
    });

    if (granularity === 'day') current.setDate(current.getDate() + 1);
    else if (granularity === 'week') current.setDate(current.getDate() + 7);
    else current.setMonth(current.setMonth() + 1);
    
    // Prevent infinite loop if range is huge
    if (growth.length > 100) break;
  }

  res.json({
    status: 'success',
    data: {
      metrics: {
        newUsers: { value: totalNewUsers, trend: '+0%', comparedTo: 'kỳ trước', variant: 'neutral' },
        dau: { value: activeNow, trend: '+0%', comparedTo: 'kỳ trước', variant: 'neutral' },
        reports: { value: totalReports, trend: '+0%', comparedTo: 'kỳ trước', variant: 'neutral' },
        retention7d: { value: '0%', trend: '+0%', comparedTo: 'kỳ trước', variant: 'neutral' }
      },
      charts: {
        growth,
        activity: {
          dauMauRatio: 0,
          totalMatches: 0,
          messagesSent: 0,
          avgSessionDuration: '0m'
        },
        safety: growth.map(g => ({ date: g.date, reports: 0, bans: 0, avgResolutionTime: 0 })),
        retention: []
      }
    }
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  const requester = await User.findById(req.user.id).select('role');
  if (!requester || requester.role !== 'admin') {
    return next(new AppError('Không có quyền truy cập.', 403));
  }

  const { id } = req.params
  const allowed = ['role', 'displayName', 'fullName', 'status', 'banReason']
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
