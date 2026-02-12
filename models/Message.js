const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // 使用字符串 id，以兼容前端 message.id
  _id: { type: String },
  groupId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  avatar: { type: String },
  content: { type: String, default: '' },
  type: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  imageUrl: { type: String, default: '' },
  // replyTo 使用字符串消息 id（而非 ObjectId）以兼容前端引用逻辑
  replyTo: { type: String, default: null },
  edited: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  // 前端使用 timestamp（ISO 字符串）
  timestamp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

messageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
