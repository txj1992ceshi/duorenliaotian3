require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Readable } = require('stream');

const nodemailer = require('nodemailer');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// =========================
// Config
// =========================
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-in-production';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-room';
const MAX_MESSAGES = Number.parseInt(process.env.MAX_MESSAGES || '100000', 10);

const CLOUDINARY_ENABLED = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const IMAGE_MAX_BYTES = Number.parseInt(process.env.IMAGE_MAX_BYTES || String(5 * 1024 * 1024), 10);
const VIDEO_MAX_BYTES = Number.parseInt(process.env.VIDEO_MAX_BYTES || String(20 * 1024 * 1024), 10);

const SMTP_ENABLED = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const ADMIN_USER = process.env.ADMIN_USER || 'tt555666';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Aa112211';

// =========================
// MongoDB
// =========================
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB 已连接'))
  .catch((err) => {
    console.error('❌ MongoDB 连接失败:', err);
    process.exit(1);
  });

// models & middleware
const User = require('./models/User');
const Group = require('./models/Group');
const Message = require('./models/Message');
const PasswordResetToken = require('./models/PasswordResetToken');
const { generateToken, authenticateToken } = require('./middleware/auth');
const isAdmin = require('./middleware/isAdmin');

// =========================
// Static + middleware
// =========================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态资源：当前仓库直接把前端文件放在根目录（index.html / main.js / styles.css 等）
app.use(express.static(__dirname));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 本地 uploads 作为开发兜底；生产建议走 Cloudinary
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// =========================
// Cloudinary
// =========================
if (CLOUDINARY_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

function getUploadFolder({ groupId }) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const safeGroup = groupId && /^[0-9]{7}$/.test(groupId) ? groupId : 'misc';
  return `chatroom/${safeGroup}/${month}`;
}

function uploadBufferToCloudinary({ buffer, filename, resourceType, folder }) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        filename_override: filename,
        use_filename: true,
        unique_filename: true
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

function getFileExtLower(name = '') {
  return path.extname(name).toLowerCase();
}

function isAllowedImage({ mimetype, originalname }) {
  const ext = getFileExtLower(originalname);
  const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  return Boolean(mimetype && mimetype.startsWith('image/') && allowedExt.has(ext));
}

function isAllowedMp4({ mimetype, originalname }) {
  const ext = getFileExtLower(originalname);
  return mimetype === 'video/mp4' && ext === '.mp4';
}

// =========================
// Upload (multer memory)
// =========================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (isAllowedImage(file) || isAllowedMp4(file)) return cb(null, true);
    cb(new Error('只支持图片(jpg/png/gif/webp)或 mp4 视频'));
  }
});

// =========================
// Email (SMTP)
// =========================
let mailer = null;
if (SMTP_ENABLED) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendResetEmail({ to, resetUrl }) {
  if (!mailer) {
    if (NODE_ENV === 'production') {
      throw new Error('SMTP 未配置');
    }
    console.log('[DEV] reset url:', resetUrl);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await mailer.sendMail({
    from,
    to,
    subject: '重置密码 - 聊天室',
    text: `请点击链接重置密码：${resetUrl}`,
    html: `<p>请点击链接重置密码：</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  });
}

// =========================
// Helpers
// =========================
function generateGroupId() {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

function generateMessageId() {
  return `${Date.now()}${Math.random().toString(36).slice(2, 11)}`;
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function toPublicUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    username: userDoc.username,
    email: userDoc.email,
    avatar: userDoc.avatar,
    role: userDoc.role,
    groups: userDoc.groups || [],
    isBanned: Boolean(userDoc.isBanned)
  };
}

function serializeMessage(doc) {
  return {
    id: doc._id,
    groupId: doc.groupId,
    userId: doc.userId.toString(),
    username: doc.username,
    avatar: doc.avatar,
    content: doc.content,
    type: doc.type,
    imageUrl: doc.imageUrl,
    replyTo: doc.replyTo,
    timestamp: doc.timestamp,
    edited: Boolean(doc.edited),
    pinned: Boolean(doc.pinned)
  };
}

function serializeGroupBasic(groupDoc) {
  return {
    id: groupDoc._id,
    name: groupDoc.name,
    description: groupDoc.description || '',
    ownerId: groupDoc.ownerId.toString(),
    admins: (groupDoc.admins || []).map((a) => a.toString()),
    members: (groupDoc.members || []).map((m) => m.toString()),
    createdAt: groupDoc.createdAt ? new Date(groupDoc.createdAt).toISOString() : new Date().toISOString(),
    announcement: groupDoc.announcement || '',
    muteAll: Boolean(groupDoc.muteAll),
    pinnedMessages: groupDoc.pinnedMessages || []
  };
}

async function createMessageAndCleanup(payload) {
  const msg = await Message.create(payload);

  const total = await Message.estimatedDocumentCount();
  if (total > MAX_MESSAGES) {
    const exceed = total - MAX_MESSAGES;
    const toDelete = await Message.find().sort({ createdAt: 1 }).limit(exceed).select('_id');
    const ids = toDelete.map((d) => d._id);
    await Message.deleteMany({ _id: { $in: ids } });
    console.log(`消息清理：删除 ${ids.length} 条最旧消息`);
  }

  return msg;
}

function userHasGroupAdminRights({ groupDoc, userId }) {
  const uid = userId.toString();
  return groupDoc.ownerId.toString() === uid || (groupDoc.admins || []).some((a) => a.toString() === uid);
}

function ensureIsGroupMember({ groupDoc, userId }) {
  const uid = userId.toString();
  return (groupDoc.members || []).some((m) => m.toString() === uid);
}

function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: '需要管理员登录' });
  }
  const token = header.replace('Basic ', '');
  const decoded = Buffer.from(token, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).json({ error: '账号或密码错误' });
  }
  return next();
}

// =========================
// API
// =========================

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: '请填写所有必填项' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ error: '用户名或邮箱已存在' });

    const hashed = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

    let user = await User.create({ username, email, password: hashed, avatar });

    // 自动把首个注册用户设为 admin（如果数据库当前没有 admin）
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      user.role = 'admin';
      await user.save();
      console.log('首位注册用户已自动设为 admin:', user.username);
    }

    const token = generateToken(user._id);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    if (user.isBanned) return res.status(403).json({ error: '账号已被封禁' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '用户名或密码错误' });

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// 忘记密码 - 发送重置邮件
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '邮箱不能为空' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: '如果邮箱存在,重置链接已发送' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordResetToken.create({ tokenHash, userId: user._id, expiresAt });

    const resetUrl = `${APP_BASE_URL.replace(/\/$/, '')}/reset-password.html?token=${rawToken}`;
    await sendResetEmail({ to: email, resetUrl });

    const payload = { message: '如果邮箱存在,重置链接已发送' };
    if (NODE_ENV !== 'production' && !mailer) {
      payload.devToken = rawToken;
    }
    res.json(payload);
  } catch (err) {
    console.error('忘记密码错误:', err);
    res.status(500).json({ error: '处理失败' });
  }
});

// 重置密码
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: '参数错误' });
    if (String(newPassword).length < 6) return res.status(400).json({ error: '密码至少需要6位字符' });

    const tokenHash = sha256Hex(token);
    const record = await PasswordResetToken.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
    if (!record) return res.status(400).json({ error: '无效或过期的重置令牌' });

    const user = await User.findById(record.userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await PasswordResetToken.deleteOne({ _id: record._id });

    res.json({ message: '密码重置成功' });
  } catch (err) {
    console.error('重置密码错误:', err);
    res.status(500).json({ error: '重置失败' });
  }
});

// 获取当前用户信息
app.get('/api/user/me', authenticateToken, async (req, res) => {
  if (!req.user) return res.status(404).json({ error: '用户不存在' });
  res.json(req.user);
});

// 创建群组
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: '群组名称不能为空' });

    let gid = generateGroupId();
    // 确保唯一
    // eslint-disable-next-line no-await-in-loop
    while (await Group.findById(gid)) {
      gid = generateGroupId();
    }

    const group = await Group.create({
      _id: gid,
      name: name.trim(),
      description: (description || '').trim(),
      ownerId: req.userId,
      admins: [],
      members: [req.userId]
    });

    await User.findByIdAndUpdate(req.userId, { $addToSet: { groups: gid } });
    res.json(serializeGroupBasic(group));
  } catch (err) {
    console.error('创建群组错误:', err);
    res.status(500).json({ error: '创建群组失败' });
  }
});

// 搜索群组
app.get('/api/groups/search/:groupId', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });

    res.json({
      id: group._id,
      name: group.name,
      description: group.description || '',
      memberCount: (group.members || []).length
    });
  } catch (err) {
    console.error('搜索群组错误:', err);
    res.status(500).json({ error: '搜索群组失败' });
  }
});

// 加入群组
app.post('/api/groups/:groupId/join', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });

    if (ensureIsGroupMember({ groupDoc: group, userId: req.userId })) {
      return res.status(400).json({ error: '您已经是该群组成员' });
    }

    group.members.push(req.userId);
    await group.save();

    await User.findByIdAndUpdate(req.userId, { $addToSet: { groups: group._id } });

    io.to(group._id).emit('member_joined', {
      groupId: group._id,
      userId: req.userId.toString(),
      username: req.user?.username
    });

    res.json(serializeGroupBasic(group));
  } catch (err) {
    console.error('加入群组错误:', err);
    res.status(500).json({ error: '加入群组失败' });
  }
});

// 获取用户的所有群组
app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId }).sort({ createdAt: -1 });
    res.json(groups.map(serializeGroupBasic));
  } catch (err) {
    console.error('获取群组列表错误:', err);
    res.status(500).json({ error: '获取群组列表失败' });
  }
});

// 获取群组详情（含成员信息）
app.get('/api/groups/:groupId', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });
    if (!ensureIsGroupMember({ groupDoc: group, userId: req.userId })) return res.status(403).json({ error: '您不是该群组成员' });

    const members = await User.find({ _id: { $in: group.members } }).select('username avatar').lean();
    const admins = new Set((group.admins || []).map((a) => a.toString()));
    const ownerId = group.ownerId.toString();

    const membersInfo = members.map((u) => {
      const uid = u._id.toString();
      const online = (onlineUsers.get(uid)?.size || 0) > 0;
      return {
        id: uid,
        username: u.username,
        avatar: u.avatar,
        role: uid === ownerId ? 'owner' : (admins.has(uid) ? 'admin' : 'member'),
        isOnline: online
      };
    });

    res.json({
      ...serializeGroupBasic(group),
      membersInfo
    });
  } catch (err) {
    console.error('获取群组详情错误:', err);
    res.status(500).json({ error: '获取群组详情失败' });
  }
});

// 更新群公告
app.put('/api/groups/:groupId/announcement', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });
    if (!userHasGroupAdminRights({ groupDoc: group, userId: req.userId })) return res.status(403).json({ error: '只有群主和管理员可以修改公告' });

    group.announcement = req.body.announcement || '';
    await group.save();

    io.to(group._id).emit('announcement_updated', { groupId: group._id, announcement: group.announcement });
    res.json({ announcement: group.announcement });
  } catch (err) {
    console.error('更新公告错误:', err);
    res.status(500).json({ error: '更新公告失败' });
  }
});

// 全员禁言
app.put('/api/groups/:groupId/mute-all', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });
    if (!userHasGroupAdminRights({ groupDoc: group, userId: req.userId })) return res.status(403).json({ error: '只有群主和管理员可以设置全员禁言' });

    group.muteAll = Boolean(req.body.muteAll);
    await group.save();

    io.to(group._id).emit('mute_all_updated', { groupId: group._id, muteAll: group.muteAll });
    res.json({ muteAll: group.muteAll });
  } catch (err) {
    console.error('全员禁言错误:', err);
    res.status(500).json({ error: '设置失败' });
  }
});

// 设置/取消管理员（仅群主）
app.put('/api/groups/:groupId/admins', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });
    if (group.ownerId.toString() !== req.userId.toString()) return res.status(403).json({ error: '只有群主可以设置管理员' });

    const { userId, action } = req.body || {};
    if (!userId || (action !== 'add' && action !== 'remove')) {
      return res.status(400).json({ error: '参数错误：需要 userId 与 action(add/remove)' });
    }

    if (!ensureIsGroupMember({ groupDoc: group, userId })) return res.status(400).json({ error: '该用户不是群成员' });
    if (userId.toString() === group.ownerId.toString()) return res.status(400).json({ error: '群主无需设置为管理员' });

    const already = (group.admins || []).some((a) => a.toString() === userId.toString());
    if (action === 'add' && !already) group.admins.push(userId);
    if (action === 'remove' && already) group.admins = group.admins.filter((a) => a.toString() !== userId.toString());
    await group.save();

    io.to(group._id).emit('group_updated', { groupId: group._id });
    res.json({ admins: (group.admins || []).map((a) => a.toString()) });
  } catch (err) {
    console.error('设置管理员错误:', err);
    res.status(500).json({ error: '设置失败' });
  }
});

// 获取群组消息
app.get('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: '群组不存在' });
    if (!ensureIsGroupMember({ groupDoc: group, userId: req.userId })) return res.status(403).json({ error: '您不是该群组成员' });

    const limit = Math.min(Number.parseInt(req.query.limit || '200', 10), 500);
    const before = req.query.before;

    const filter = { groupId: group._id };
    if (before) {
      // before 支持 ISO timestamp
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(limit);
    res.json(messages.map(serializeMessage));
  } catch (err) {
    console.error('获取群组消息错误:', err);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 上传图片/视频（转发到 Cloudinary；未配置时回退到本地 uploads）
app.post('/api/upload', authenticateToken, upload.any(), async (req, res) => {
  try {
    const file = (req.files || [])[0];
    if (!file) return res.status(400).json({ error: '没有文件上传' });

    const groupId = (req.body && req.body.groupId) ? String(req.body.groupId) : undefined;

    const isImg = isAllowedImage(file);
    const isMp4 = isAllowedMp4(file);

    if (isImg && file.size > IMAGE_MAX_BYTES) return res.status(400).json({ error: `图片大小不能超过 ${Math.floor(IMAGE_MAX_BYTES / (1024 * 1024))}MB` });
    if (isMp4 && file.size > VIDEO_MAX_BYTES) return res.status(400).json({ error: `视频大小不能超过 ${Math.floor(VIDEO_MAX_BYTES / (1024 * 1024))}MB` });

    const resourceType = isMp4 ? 'video' : 'image';

    if (CLOUDINARY_ENABLED) {
      const folder = getUploadFolder({ groupId });
      const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        filename: file.originalname,
        resourceType,
        folder
      });
      return res.json({ url: result.secure_url, resourceType });
    }

    // fallback: store locally
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = getFileExtLower(file.originalname) || (isMp4 ? '.mp4' : '.jpg');
    const filename = `${uniqueSuffix}${ext}`;
    const dest = path.join(uploadsDir, filename);
    await fs.promises.writeFile(dest, file.buffer);

    return res.json({ url: `/uploads/${filename}`, resourceType });
  } catch (err) {
    console.error('上传错误:', err);
    res.status(500).json({ error: '上传失败' });
  }
});

// Admin routes（全局管理员）
app.get('/api/admin/users', basicAuth, async (req, res) => {
  const users = await User.find().lean();
  const now = Date.now();
  const result = users.map((u) => {
    const last = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : null;
    const created = u.createdAt ? new Date(u.createdAt).getTime() : null;
    const base = last || created || null;
    const daysSince = base ? Math.floor((now - base) / (1000 * 60 * 60 * 24)) : null;
    return {
      id: u._id.toString(),
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt || null,
      lastLoginAt: u.lastLoginAt || null,
      daysSinceLastLogin: daysSince,
      isBanned: Boolean(u.isBanned),
      bannedAt: u.bannedAt || null
    };
  });
  res.json(result);
});

app.put('/api/admin/users/:id/ban', basicAuth, async (req, res) => {
  const uid = req.params.id;
  const { banned } = req.body || {};
  const user = await User.findById(uid);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  user.isBanned = Boolean(banned);
  user.bannedAt = user.isBanned ? new Date() : null;
  await user.save();
  res.json({ id: user._id.toString(), isBanned: user.isBanned, bannedAt: user.bannedAt });
});

app.put('/api/admin/users/:id/password', basicAuth, async (req, res) => {
  const uid = req.params.id;
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: '新密码至少 6 位' });
  }
  const user = await User.findById(uid);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  user.password = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  res.json({ message: '密码已更新' });
});

app.get('/api/admin/stats', basicAuth, async (req, res) => {
  const usersCount = await User.countDocuments();
  const groupsCount = await Group.countDocuments();
  const messagesCount = await Message.countDocuments();
  const onlineCount = Array.from(onlineUsers.values()).reduce((sum, set) => sum + (set?.size || 0), 0);
  res.json({ usersCount, groupsCount, messagesCount, onlineCount });
});

// =========================
// Socket.IO
// =========================
// userId -> Set(socketId)
const onlineUsers = new Map();

function markOnline(userId, socketId) {
  const uid = userId.toString();
  const set = onlineUsers.get(uid) || new Set();
  const wasEmpty = set.size === 0;
  set.add(socketId);
  onlineUsers.set(uid, set);
  return { wasEmpty };
}

function markOffline(userId, socketId) {
  const uid = userId.toString();
  const set = onlineUsers.get(uid);
  if (!set) return { isEmpty: true };
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(uid);
    return { isEmpty: true };
  }
  onlineUsers.set(uid, set);
  return { isEmpty: false };
}

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 用户身份验证
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded) return;

      const user = await User.findById(decoded.userId);
      if (!user) return;
      if (user.isBanned) {
        socket.emit('error', { message: '账号已被封禁' });
        socket.disconnect(true);
        return;
      }

      socket.userId = decoded.userId;
      const { wasEmpty } = markOnline(decoded.userId, socket.id);

      // 加入用户所有群组房间
      for (const gid of user.groups || []) {
        socket.join(gid);
      }

      // 仅首次上线时广播 online（避免多标签页重复刷屏）
      if (wasEmpty) {
        for (const gid of user.groups || []) {
          io.to(gid).emit('user_online', {
            userId: user._id.toString(),
            username: user.username
          });
        }
      }
    } catch (err) {
      // ignore
    }
  });

  // 加入群组房间（用于切换群后确保能收到广播）
  socket.on('join_group', async (groupId) => {
    try {
      if (!socket.userId) return;
      if (!groupId) return;

      const group = await Group.findById(groupId);
      if (!group) return;
      if (!ensureIsGroupMember({ groupDoc: group, userId: socket.userId })) return;

      socket.join(groupId);

      // 兜底：确保用户 groups 有该群
      await User.findByIdAndUpdate(socket.userId, { $addToSet: { groups: groupId } });
    } catch (_) {}
  });

  socket.on('leave_group', (groupId) => {
    if (!socket.userId) return;
    if (!groupId) return;
    socket.leave(groupId);
  });

  // 发送消息
  socket.on('send_message', async (data) => {
    try {
      if (!socket.userId) return;

      const { groupId, content, type, replyTo, imageUrl } = data || {};
      const group = await Group.findById(groupId);
      if (!group) return;
      if (!ensureIsGroupMember({ groupDoc: group, userId: socket.userId })) return;

      // 检查全员禁言
      const isGroupAdmin = userHasGroupAdminRights({ groupDoc: group, userId: socket.userId });
      if (group.muteAll && !isGroupAdmin) {
        socket.emit('error', { message: '当前群组已开启全员禁言' });
        return;
      }

      const user = await User.findById(socket.userId);
      if (!user) return;

      const nowIso = new Date().toISOString();
      const messagePayload = {
        _id: generateMessageId(),
        groupId,
        userId: user._id,
        username: user.username,
        avatar: user.avatar || '',
        content: content || '',
        type: type || 'text',
        imageUrl: imageUrl || '',
        replyTo: replyTo || null,
        edited: false,
        pinned: false,
        timestamp: nowIso,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const message = await createMessageAndCleanup(messagePayload);
      io.to(groupId).emit('new_message', serializeMessage(message));
    } catch (err) {
      console.error('send_message error:', err);
    }
  });

  // 正在输入
  socket.on('typing', async (data) => {
    try {
      if (!socket.userId) return;
      const groupId = data?.groupId;
      if (!groupId) return;
      const user = await User.findById(socket.userId).select('username').lean();
      socket.to(groupId).emit('user_typing', {
        userId: socket.userId.toString(),
        username: user?.username,
        groupId
      });
    } catch (_) {}
  });

  // 停止输入
  socket.on('stop_typing', (data) => {
    if (!socket.userId) return;
    const groupId = data?.groupId;
    if (!groupId) return;
    socket.to(groupId).emit('user_stop_typing', {
      userId: socket.userId.toString(),
      groupId
    });
  });

  // 编辑消息
  socket.on('edit_message', async (data) => {
    try {
      if (!socket.userId) return;
      const { messageId, content } = data || {};
      if (!messageId || !content) return;

      const message = await Message.findById(messageId);
      if (!message) return;
      if (message.userId.toString() !== socket.userId.toString()) return;
      if (message.type !== 'text') return;

      message.content = String(content);
      message.edited = true;
      message.updatedAt = new Date();
      await message.save();

      io.to(message.groupId).emit('message_edited', serializeMessage(message));
    } catch (err) {
      console.error('edit_message error:', err);
    }
  });

  // 撤回消息
  socket.on('recall_message', async (data) => {
    try {
      if (!socket.userId) return;
      const messageId = data?.messageId;
      if (!messageId) return;

      const message = await Message.findById(messageId);
      if (!message) return;

      const group = await Group.findById(message.groupId);
      if (!group) return;

      const canDelete =
        message.userId.toString() === socket.userId.toString() ||
        userHasGroupAdminRights({ groupDoc: group, userId: socket.userId });

      if (!canDelete) return;

      await Message.deleteOne({ _id: messageId });
      if (group.pinnedMessages?.includes(messageId)) {
        group.pinnedMessages = group.pinnedMessages.filter((id) => id !== messageId);
        await group.save();
      }

      io.to(message.groupId).emit('message_recalled', { messageId, groupId: message.groupId });
    } catch (err) {
      console.error('recall_message error:', err);
    }
  });

  // 置顶消息（管理员/群主）
  socket.on('pin_message', async (data) => {
    try {
      if (!socket.userId) return;
      const messageId = data?.messageId;
      if (!messageId) return;

      const message = await Message.findById(messageId);
      if (!message) return;

      const group = await Group.findById(message.groupId);
      if (!group) return;
      if (!userHasGroupAdminRights({ groupDoc: group, userId: socket.userId })) return;

      message.pinned = !message.pinned;
      message.updatedAt = new Date();
      await message.save();

      group.pinnedMessages = group.pinnedMessages || [];
      if (message.pinned) {
        if (!group.pinnedMessages.includes(messageId)) group.pinnedMessages.push(messageId);
      } else {
        group.pinnedMessages = group.pinnedMessages.filter((id) => id !== messageId);
      }
      await group.save();

      io.to(message.groupId).emit('message_pinned', {
        messageId: messageId,
        pinned: message.pinned,
        groupId: message.groupId
      });
    } catch (err) {
      console.error('pin_message error:', err);
    }
  });

  socket.on('disconnect', async () => {
    console.log('用户断开:', socket.id);
    if (!socket.userId) return;

    const { isEmpty } = markOffline(socket.userId, socket.id);
    if (!isEmpty) return;

    try {
      const user = await User.findById(socket.userId);
      if (!user) return;
      for (const gid of user.groups || []) {
        io.to(gid).emit('user_offline', {
          userId: user._id.toString(),
          username: user.username
        });
      }
    } catch (_) {}
  });
});

// =========================
// Start
// =========================
server.listen(PORT, () => {
  console.log(`服务器运行在 ${APP_BASE_URL}`);
  if (NODE_ENV === 'production' && !CLOUDINARY_ENABLED) {
    console.warn('⚠️ 未配置 Cloudinary，将回退到本地 /uploads（不推荐生产使用）');
  }
  if (NODE_ENV === 'production' && !SMTP_ENABLED) {
    console.warn('⚠️ 未配置 SMTP，忘记密码邮件将无法发送');
  }
});
