const mongoose = require('mongoose');

const userReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: 'other',
    },
    note: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['high', 'normal'],
      default: 'normal',
      index: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'vibe', 'story', 'all'],
      default: 'user',
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    targetData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      default: null,
    },
    evidence: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserReport', userReportSchema);

