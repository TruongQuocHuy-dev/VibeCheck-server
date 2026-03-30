const mongoose = require('mongoose');

const storyViewSchema = new mongoose.Schema(
  {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VibeStory',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure one view record per user-story pair
storyViewSchema.index({ storyId: 1, user: 1 }, { unique: true });

const StoryView = mongoose.model('StoryView', storyViewSchema);

module.exports = StoryView;
