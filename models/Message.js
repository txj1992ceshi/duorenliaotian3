const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  groupId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  avatar: { type: String },
  content: { type: String, default: '' },
  type: { type: String, default: 'text' },
  imageUrl: { type: String, default: '' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  edited: { type: Boolean, default: false },
  pinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true }
});

messageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);