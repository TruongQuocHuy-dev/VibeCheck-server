const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
      type: String,
      enum: ['match', 'message', 'like', 'story', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    avatar: { type: String, default: null },
    isUnread: { type: Boolean, default: true },
    // Navigation metadata for frontend
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// TTL: auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
