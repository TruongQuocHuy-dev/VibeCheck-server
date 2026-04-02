const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: false,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'story_reply'],
      default: 'text',
    },
    storyReference: {
      storyId: { type: mongoose.Schema.Types.ObjectId, ref: 'VibeStory' },
      imageUrl: String,
      caption: String,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    mediaUrl: String,
    publicId: String,
    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio'],
    },
    mediaList: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        mediaType: { type: String, enum: ['image', 'video', 'audio'], required: true },
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deletedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isRecalled: {
      status: { type: Boolean, default: false },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
