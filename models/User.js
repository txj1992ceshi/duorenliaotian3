const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String },
  role: { type: String, enum: ['user','admin'], default: 'user' },
  groups: [{ type: String }], // groupId 使用字符串以兼容前端
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null },
  userNumber: { type: String, unique: true, index: true },
  isBanned: { type: Boolean, default: false },
  bannedAt: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
