const mongoose = require('mongoose');

const vibeTagSchema = new mongoose.Schema({
  label: { type: String, required: true, unique: true },
  emoji: { type: String, required: true },
  colorType: { type: String, enum: ['cyan', 'pink'], default: 'cyan' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('VibeTag', vibeTagSchema);
