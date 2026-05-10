const mongoose = require('mongoose');

const PageVersionSchema = new mongoose.Schema(
  {
    pageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    title: String,
    content: {
      type: String,
      required: true,
    },
    language: String,
    metadata: Object,
    status: String,
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changeSummary: {
      type: String,
      default: '',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index for getting versions of a page in descending order
PageVersionSchema.index({ pageId: 1, versionNumber: -1 });

const PageVersion = mongoose.model('PageVersion', PageVersionSchema);

module.exports = PageVersion;
