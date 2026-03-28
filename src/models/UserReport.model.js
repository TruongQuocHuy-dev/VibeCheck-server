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
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserReport', userReportSchema);
