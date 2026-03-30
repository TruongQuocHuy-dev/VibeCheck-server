const mongoose = require('mongoose');

const storyReactionSchema = new mongoose.Schema(
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
    reactions: [
      {
        type: String,
      }
    ],
  },
  { timestamps: true }
);

// Unique index to ensure one reaction document per user-story pair
storyReactionSchema.index({ storyId: 1, user: 1 }, { unique: true });

const StoryReaction = mongoose.model('StoryReaction', storyReactionSchema);

module.exports = StoryReaction;
