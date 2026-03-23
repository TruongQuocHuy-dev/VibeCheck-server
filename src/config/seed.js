const { VibeTag } = require('../models');

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

module.exports = { seedVibes };
