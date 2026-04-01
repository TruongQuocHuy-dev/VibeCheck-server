const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    clearedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        clearedAt: { type: Date, default: Date.now },
      },
    ],
    unreadCounts: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 0 },
      },
    ],
    blockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Index for fast lookup by participants
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
