const mongoose = require('mongoose');

const vibeTagSchema = new mongoose.Schema({
  label: { type: String, required: true },
  emoji: { type: String, required: true },
  colorType: { type: String, enum: ['cyan', 'pink'], default: 'cyan' },
});

module.exports = mongoose.model('VibeTag', vibeTagSchema);
