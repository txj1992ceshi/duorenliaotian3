require('dotenv').config();
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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-room';
const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-in-production';
const PORT = process.env.PORT || 3000;
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES || '100000', 10);

// connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB 已连接'))
  .catch(err => {
    console.error('❌ MongoDB 连接失败:', err);
    process.exit(1);
  });

// models & middleware
const User = require('./models/User');
const Group = require('./models/Group');
const Message = require('./models/Message');
const { generateToken, authenticateToken } = require('./middleware/auth');
const isAdmin = require('./middleware/isAdmin');

// middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// create uploads dir for local/dev usage
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// multer (development only - production should forward to external image host)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('只支持图片/视频文件!'));
  }
});

// socket online map
const onlineUsers = new Map();

// helper: generate group id
function generateGroupId() {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

// message creation + cleanup
async function createMessageAndCleanup(payload) {
  const msg = await Message.create(payload);

  const total = await Message.estimatedDocumentCount();
  if (total > MAX_MESSAGES) {
    const exceed = total - MAX_MESSAGES;
    const toDelete = await Message.find().sort({ createdAt: 1 }).limit(exceed).select('_id');
    const ids = toDelete.map(d => d._id);
    await Message.deleteMany({ _id: { $in: ids } });
    console.log(`消息清理：删除 ${ids.length} 条最旧消息`);
  }

  return msg;
}

// =========== API ===========

// register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: '请填写所有必填项' });

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
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar, role: user.role }
    });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '用户名或密码错误' });

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar, role: user.role }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// get current user
app.get('/api/user/me', authenticateToken, async (req, res) => {
  const user = req.user;
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

// create group
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: '群组名称不能为空' });

    const gid = generateGroupId();
    const group = await Group.create({
      _id: gid,
      name,
      description: description || '',
      ownerId: req.userId,
      admins: [],
      members: [req.userId]
    });

    // 更新用户 groups（字符串 id）
    await User.findByIdAndUpdate(req.userId, { $push: { groups: gid } });

    res.json(group);
  } catch (err) {
    console.error('创建群组错误:', err);
    res.status(500).json({ error: '创建群组失败' });
  }
});

// upload (development only)
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件上传' });

  // 提示：生产应将文件转发到图床（Cloudinary / ImgBB 等），并把返回的 URL 存入 Message.imageUrl
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Admin routes
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  const users = await User.find().select('-password').lean();
  res.json(users);
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const uid = req.params.id;
  await User.findByIdAndDelete(uid);
  await Message.deleteMany({ userId: uid });
  await Group.updateMany({}, { $pull: { members: mongoose.Types.ObjectId(uid), admins: mongoose.Types.ObjectId(uid) } });
  res.json({ message: '用户已删除' });
});

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  const usersCount = await User.countDocuments();
  const groupsCount = await Group.countDocuments();
  const messagesCount = await Message.countDocuments();
  res.json({ usersCount, groupsCount, messagesCount, onlineCount: onlineUsers.size });
});

app.post('/api/admin/messages/cleanup', authenticateToken, isAdmin, async (req, res) => {
  const total = await Message.countDocuments();
  if (total <= MAX_MESSAGES) return res.json({ message: '无需清理', total });
  const exceed = total - MAX_MESSAGES;
  const toDelete = await Message.find().sort({ createdAt: 1 }).limit(exceed).select('_id');
  const ids = toDelete.map(d => d._id);
  await Message.deleteMany({ _id: { $in: ids } });
  res.json({ message: `已删除 ${ids.length} 条消息`, totalAfter: await Message.countDocuments() });
});

// =========== Socket.IO ===========
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded) return;
      socket.userId = decoded.userId;
      onlineUsers.set(decoded.userId.toString(), socket.id);

      const user = await User.findById(decoded.userId);
      if (user) {
        // 加入用户所有群组房间
        for (const gid of user.groups || []) {
          socket.join(gid);
        }

        // 通知群组其他成员该用户上线
        for (const gid of user.groups || []) {
          io.to(gid).emit('user_online', { userId: user._id.toString(), username: user.username });
        }
      }
    } catch (err) {
      // ignore
    }
  });

  socket.on('send_message', async (data) => {
    if (!socket.userId) return;
    const { groupId, content, type, replyTo, imageUrl } = data;
    const group = await Group.findById(groupId);
    if (!group || !group.members.some(m => m.toString() === socket.userId.toString())) return;

    if (group.muteAll && group.ownerId.toString() !== socket.userId.toString() && !group.admins.map(a => a.toString()).includes(socket.userId.toString())) {
      socket.emit('error', { message: '当前群组已开启全员禁言' });
      return;
    }

    const user = await User.findById(socket.userId);

    const messagePayload = {
      groupId,
      userId: socket.userId,
      username: user ? user.username : '未知用户',
      avatar: user ? user.avatar : '',
      content,
      type: type || 'text',
      imageUrl,
      replyTo
    };

    const message = await createMessageAndCleanup(messagePayload);

    io.to(groupId).emit('new_message', message);
  });

  socket.on('disconnect', () => {
    console.log('用户断开:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId.toString());
    }
  });
});

// start server
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});