const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  _id: { type: String }, // 使用字符串 id，与原 generateGroupId 兼容
  type: { type: String, enum: ['group', 'dm'], default: 'group' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  joinRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  announcement: { type: String, default: '' },
  muteAll: { type: Boolean, default: false },
  // 置顶消息：使用消息 id（字符串）以兼容前端 currentGroup.pinnedMessages
  pinnedMessages: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
