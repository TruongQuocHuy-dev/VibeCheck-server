const mongoose = require('mongoose');

const BlacklistSchema = new mongoose.Schema(
  {
    word: {
      type: String,
      required: [true, 'Từ khóa là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['exact', 'contains', 'regex'],
      default: 'contains',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
BlacklistSchema.index({ word: 1 });

// Middleware to normalize word before saving
BlacklistSchema.pre('save', function (next) {
  if (this.word) {
    this.word = this.word.toLowerCase().trim();
  }
  next();
});

const Blacklist = mongoose.model('Blacklist', BlacklistSchema);

module.exports = Blacklist;
