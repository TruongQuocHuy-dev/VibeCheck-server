const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: String, // Can be ObjectId or string id
      required: false,
    },
    targetModel: {
      type: String,
      required: false,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;
