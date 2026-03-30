const mongoose = require('mongoose');

const MusicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    artist: { type: String, required: true },
    coverUrl: { type: String },
    previewUrl: { type: String, required: true },
    startTime: { type: Number, default: 0 },
    musicDuration: { type: Number, default: 20 },
  },
  { _id: false }
);

const VibeStorySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: false, // Cho phép đăng Vibe chỉ có chữ
    },
    caption: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: Object, // { area: String, displayLabel: String }
      default: null,
    },
    music: {
      type: MusicSchema,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24 hours like Instagram story
      index: { expires: '1m' }, // MongoDB TTL index to auto delete expired stories
    },
  },
  { timestamps: true }
);

const VibeStory = mongoose.model('VibeStory', VibeStorySchema);

module.exports = VibeStory;
