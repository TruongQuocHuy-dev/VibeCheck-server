const mongoose = require('mongoose');
const AuditLog = require('../src/models/AuditLog.model');
const dotenv = require('dotenv');
dotenv.config();

const checkAuditLog = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vibecheck');
  const count = await AuditLog.countDocuments();
  console.log(`Audit log count: ${count}`);
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(5);
  console.log('Recent logs:', JSON.stringify(logs, null, 2));
  await mongoose.disconnect();
};

checkAuditLog();
