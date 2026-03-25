const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: false, // Changed for Google Login
      unique: true,
      sparse: true, // Allow multiple nulls/undefineds
      trim: true,
      index: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      default: null,
    },
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      default: null, // null until user sets password after OTP verify
    },
    displayName: {
      type: String,
      default: null,
    },
    fullName: {
      type: String,
      default: null,
    },
    birthYear: {
      type: Number,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    vibes: {
      type: [String],
      default: [],
    },
    photos: {
      type: [String],
      default: [], // Extra photo URLs shown in the discovery card detail
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Instance method: Check password
UserSchema.methods.comparePassword = async function (password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

// Static method: Hash and assign password
UserSchema.statics.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
