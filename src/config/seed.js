const { VibeTag, User } = require('../models');
//   {
//     phone: '+84990000001',
//     password: 'Admin@12345',
//     fullName: 'VibeCheck Admin One',
//     displayName: 'Admin One',
//     email: 'admin1@vibecheck.local',
//   },
//   {
//     phone: '+84990000002',
//     password: 'Admin@123456',
//     fullName: 'VibeCheck Admin Two',
//     displayName: 'Admin Two',
//     email: 'admin2@vibecheck.local',
//   },
// ];

const VIBE_TAGS = [
  { label: 'La cà quán xá', emoji: '☕', colorType: 'cyan' },
  { label: 'Chạy deadline', emoji: '📚', colorType: 'pink' },
  { label: 'Đang suy', emoji: '🎧', colorType: 'pink' },
  { label: 'Nhậu nhẹt', emoji: '🍺', colorType: 'cyan' },
  { label: 'Lượn phố', emoji: '🛵', colorType: 'cyan' },
  { label: 'Yêu mèo', emoji: '🐈', colorType: 'cyan' },
  { label: 'Cháy máy', emoji: '🎮', colorType: 'pink' },
  { label: 'Mê phim', emoji: '🎬', colorType: 'pink' },
  { label: 'Gym rat', emoji: '🏋️', colorType: 'cyan' },
  { label: 'Du lịch', emoji: '✈️', colorType: 'cyan' },
  { label: 'Nghệ thuật', emoji: '🎨', colorType: 'pink' },
  { label: 'Food tour', emoji: '🍜', colorType: 'cyan' },
];

const seedVibes = async () => {
  try {
    const count = await VibeTag.countDocuments();
    if (count === 0) {
      await VibeTag.insertMany(VIBE_TAGS);
      console.log('🌱 Vibes seeded successfully!');
    }
  } catch (err) {
    console.error('Error seeding vibes:', err);
  }
};

const seedAdminAccounts = async () => {
  try {
    for (const account of ADMIN_ACCOUNTS) {
      const passwordHash = await User.hashPassword(account.password);
      const existingUser = await User.findOne({ phone: account.phone });

      if (existingUser) {
        existingUser.role = 'admin';
        existingUser.email = account.email;
        existingUser.fullName = account.fullName;
        existingUser.displayName = account.displayName;
        existingUser.passwordHash = passwordHash;
        if (!existingUser.firebaseUid) {
          existingUser.firebaseUid = `admin-${account.phone.replace(/\D/g, '')}`;
        }
        await existingUser.save();
        continue;
      }

      await User.create({
        phone: account.phone,
        email: account.email,
        firebaseUid: `admin-${account.phone.replace(/\D/g, '')}`,
        passwordHash,
        role: 'admin',
        fullName: account.fullName,
        displayName: account.displayName,
        isProfileComplete: true,
      });
    }

    console.log('🛡️ Admin accounts seeded successfully!');
  } catch (err) {
    console.error('Error seeding admin accounts:', err);
  }
};

module.exports = { seedVibes, seedAdminAccounts};
