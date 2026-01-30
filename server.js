const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 配置
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// 创建上传目录
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('只支持图片文件!'));
  }
});

// 内存数据库 (生产环境应使用真实数据库)
const db = {
  users: [],
  groups: [],
  messages: [],
  resetTokens: new Map() // 存储密码重置令牌
};

// 辅助函数
function generateGroupId() {
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// 认证中间件
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '需要登录' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: '无效的令牌' });
  }

  req.userId = decoded.userId;
  next();
}

// ============ API 路由 ============

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: '请填写所有必填项' });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 检查用户名是否已存在
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱是否已存在
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ error: '邮箱已被使用' });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      createdAt: new Date().toISOString(),
      groups: []
    };

    db.users.push(user);

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        groups: user.groups
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = db.users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        groups: user.groups
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 忘记密码 - 发送重置令牌
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = db.users.find(u => u.email === email);
    if (!user) {
      // 为了安全,即使用户不存在也返回成功
      return res.json({ message: '如果邮箱存在,重置链接已发送' });
    }

    // 生成重置令牌
    const resetToken = Math.random().toString(36).substring(2, 15);
    db.resetTokens.set(resetToken, {
      userId: user.id,
      expiresAt: Date.now() + 3600000 // 1小时后过期
    });

    // 在实际生产环境中,这里应该发送邮件
    // 现在我们只是在控制台打印
    console.log(`密码重置令牌 for ${email}: ${resetToken}`);
    console.log(`重置链接: http://localhost:${PORT}/reset-password.html?token=${resetToken}`);

    res.json({
      message: '如果邮箱存在,重置链接已发送',
      // 仅用于开发测试
      devToken: resetToken
    });
  } catch (error) {
    console.error('忘记密码错误:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

// 重置密码
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const resetData = db.resetTokens.get(token);
    if (!resetData || resetData.expiresAt < Date.now()) {
      return res.status(400).json({ error: '无效或过期的重置令牌' });
    }

    const user = db.users.find(u => u.id === resetData.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 更新密码
    user.password = await bcrypt.hash(newPassword, 10);
    db.resetTokens.delete(token);

    res.json({ message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '重置失败' });
  }
});

// 获取当前用户信息
app.get('/api/user/me', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    groups: user.groups
  });
});

// 创建群组
app.post('/api/groups', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: '群组名称不能为空' });
    }

    const group = {
      id: generateGroupId(),
      name,
      description: description || '',
      ownerId: req.userId,
      admins: [],
      members: [req.userId],
      createdAt: new Date().toISOString(),
      announcement: '',
      muteAll: false,
      pinnedMessages: []
    };

    db.groups.push(group);

    // 更新用户的群组列表
    const user = db.users.find(u => u.id === req.userId);
    if (user) {
      user.groups.push(group.id);
    }

    res.json(group);
  } catch (error) {
    console.error('创建群组错误:', error);
    res.status(500).json({ error: '创建群组失败' });
  }
});

// 搜索群组
app.get('/api/groups/search/:groupId', authenticateToken, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: '群组不存在' });
  }

  res.json({
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount: group.members.length
  });
});

// 加入群组
app.post('/api/groups/:groupId/join', authenticateToken, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: '群组不存在' });
  }

  if (group.members.includes(req.userId)) {
    return res.status(400).json({ error: '您已经是该群组成员' });
  }

  group.members.push(req.userId);

  const user = db.users.find(u => u.id === req.userId);
  if (user && !user.groups.includes(group.id)) {
    user.groups.push(group.id);
  }

  // 通知群组成员
  io.to(group.id).emit('member_joined', {
    groupId: group.id,
    userId: req.userId,
    username: user?.username
  });

  res.json(group);
});

// 获取用户的所有群组
app.get('/api/groups', authenticateToken, (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const userGroups = db.groups.filter(g => g.members.includes(req.userId));
  res.json(userGroups);
});

// 获取群组详情
app.get('/api/groups/:groupId', authenticateToken, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: '群组不存在' });
  }

  if (!group.members.includes(req.userId)) {
    return res.status(403).json({ error: '您不是该群组成员' });
  }

  // 获取成员信息
  const membersInfo = group.members.map(memberId => {
    const user = db.users.find(u => u.id === memberId);
    return user ? {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      isOnline: false // 将通过 Socket.IO 更新
    } : null;
  }).filter(Boolean);

  res.json({
    ...group,
    membersInfo
  });
});

// 获取群组消息
app.get('/api/groups/:groupId/messages', authenticateToken, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: '群组不存在' });
  }

  if (!group.members.includes(req.userId)) {
    return res.status(403).json({ error: '您不是该群组成员' });
  }

  const messages = db.messages
    .filter(m => m.groupId === req.params.groupId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  res.json(messages);
});

// 更新群公告
app.put('/api/groups/:groupId/announcement', authenticateToken, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: '群组不存在' });
  }

  // 检查权限
  if (group.ownerId !== req.userId && !group.admins.includes(req.userId)) {
    return res.status(403).json({ error: '只有群主和管理员可以修改公告' });
  }

  group.announcement = req.body.announcement || '';

  io.to(group.id).emit('announcement_updated', {
    groupId: group.id,
    announcement: group.announcement
  });

  res.json({ announcement: group.announcement });
});

// 全员禁言
app.put('/api/groups/:groupId/mute-all', authenticateToken, (req, res) => {
  const group = db.groups.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).json({ error: '群组不存在' });
  }

  if (group.ownerId !== req.userId && !group.admins.includes(req.userId)) {
    return res.status(403).json({ error: '只有群主和管理员可以设置全员禁言' });
  }

  group.muteAll = req.body.muteAll;

  io.to(group.id).emit('mute_all_updated', {
    groupId: group.id,
    muteAll: group.muteAll
  });

  res.json({ muteAll: group.muteAll });
});

// 上传图片
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有文件上传' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// ============ Socket.IO ============

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 用户身份验证
  socket.on('authenticate', (token) => {
    const decoded = verifyToken(token);
    if (decoded) {
      socket.userId = decoded.userId;
      onlineUsers.set(decoded.userId, socket.id);

      const user = db.users.find(u => u.id === decoded.userId);
      if (user) {
        // 加入用户的所有群组
        user.groups.forEach(groupId => {
          socket.join(groupId);
        });

        // 通知所有群组该用户上线
        user.groups.forEach(groupId => {
          io.to(groupId).emit('user_online', {
            userId: user.id,
            username: user.username
          });
        });
      }
    }
  });

  // 发送消息
  socket.on('send_message', (data) => {
    if (!socket.userId) return;

    const { groupId, content, type, replyTo, imageUrl } = data;
    const group = db.groups.find(g => g.id === groupId);

    if (!group || !group.members.includes(socket.userId)) {
      return;
    }

    // 检查全员禁言
    if (group.muteAll && group.ownerId !== socket.userId && !group.admins.includes(socket.userId)) {
      socket.emit('error', { message: '当前群组已开启全员禁言' });
      return;
    }

    const user = db.users.find(u => u.id === socket.userId);

    const message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      groupId,
      userId: socket.userId,
      username: user?.username || '未知用户',
      avatar: user?.avatar || '',
      content,
      type: type || 'text',
      imageUrl,
      replyTo,
      timestamp: new Date().toISOString(),
      edited: false,
      pinned: false
    };

    db.messages.push(message);

    // 广播消息到群组
    io.to(groupId).emit('new_message', message);
  });

  // 正在输入
  socket.on('typing', (data) => {
    if (!socket.userId) return;

    const user = db.users.find(u => u.id === socket.userId);
    socket.to(data.groupId).emit('user_typing', {
      userId: socket.userId,
      username: user?.username,
      groupId: data.groupId
    });
  });

  // 停止输入
  socket.on('stop_typing', (data) => {
    if (!socket.userId) return;

    socket.to(data.groupId).emit('user_stop_typing', {
      userId: socket.userId,
      groupId: data.groupId
    });
  });

  // 编辑消息
  socket.on('edit_message', (data) => {
    if (!socket.userId) return;

    const message = db.messages.find(m => m.id === data.messageId);

    if (message && message.userId === socket.userId) {
      message.content = data.content;
      message.edited = true;

      io.to(message.groupId).emit('message_edited', message);
    }
  });

  // 撤回消息
  socket.on('recall_message', (data) => {
    if (!socket.userId) return;

    const message = db.messages.find(m => m.id === data.messageId);

    if (message) {
      const group = db.groups.find(g => g.id === message.groupId);

      // 检查权限: 消息发送者或管理员
      if (message.userId === socket.userId ||
          (group && (group.ownerId === socket.userId || group.admins.includes(socket.userId)))) {

        const index = db.messages.findIndex(m => m.id === data.messageId);
        if (index > -1) {
          db.messages.splice(index, 1);
        }

        io.to(message.groupId).emit('message_recalled', {
          messageId: data.messageId,
          groupId: message.groupId
        });
      }
    }
  });

  // 置顶消息
  socket.on('pin_message', (data) => {
    if (!socket.userId) return;

    const message = db.messages.find(m => m.id === data.messageId);

    if (message) {
      const group = db.groups.find(g => g.id === message.groupId);

      if (group && (group.ownerId === socket.userId || group.admins.includes(socket.userId))) {
        message.pinned = !message.pinned;

        if (message.pinned) {
          if (!group.pinnedMessages.includes(message.id)) {
            group.pinnedMessages.push(message.id);
          }
        } else {
          const index = group.pinnedMessages.indexOf(message.id);
          if (index > -1) {
            group.pinnedMessages.splice(index, 1);
          }
        }

        io.to(message.groupId).emit('message_pinned', {
          messageId: message.id,
          pinned: message.pinned,
          groupId: message.groupId
        });
      }
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开:', socket.id);

    if (socket.userId) {
      const user = db.users.find(u => u.id === socket.userId);

      if (user) {
        user.groups.forEach(groupId => {
          io.to(groupId).emit('user_offline', {
            userId: user.id,
            username: user.username
          });
        });
      }

      onlineUsers.delete(socket.userId);
    }
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
