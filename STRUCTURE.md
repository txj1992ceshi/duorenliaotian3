# 📁 项目结构说明

```
chat-room/
├── server/                 # 后端服务器
│   ├── server.js          # Express + Socket.IO 服务器主文件
│   └── uploads/           # 图片上传目录 (运行时创建)
│
├── public/                # 前端静态文件
│   ├── index.html         # 主页面 (登录/注册/聊天)
│   ├── reset-password.html # 密码重置页面
│   ├── styles.css         # 苹果风格样式表
│   └── main.js            # 前端核心逻辑 (Socket.IO 客户端)
│
├── docs/                  # 文档
│   ├── DEPLOYMENT.md      # 详细部署指南
│   └── QUICKSTART.md      # 快速开始指南
│
├── package.json           # npm 依赖配置
├── .gitignore            # Git 忽略文件
├── LICENSE               # MIT 许可证
└── README.md             # 项目说明文档
```

## 📄 文件说明

### 后端文件

**server/server.js** (17KB)
- Express 服务器配置
- Socket.IO 实时通讯
- RESTful API 路由
- JWT 认证中间件
- 文件上传处理
- 内存数据库 (可替换为 MongoDB/PostgreSQL)

### 前端文件

**public/index.html** (19KB)
- 登录/注册页面
- 主聊天界面
- 群组管理界面
- 模态框组件
- 响应式布局

**public/styles.css** (22KB)
- 苹果风格设计系统
- 流畅动画效果
- 响应式媒体查询
- 自定义滚动条
- 渐变背景

**public/main.js** (33KB)
- Socket.IO 客户端连接
- 消息收发逻辑
- 图片上传与压缩
- 实时状态更新
- 本地存储管理
- 多标签页同步

**public/reset-password.html** (3KB)
- 密码重置表单
- Token 验证逻辑

### 配置文件

**package.json**
- 项目元信息
- npm 依赖列表
- 启动脚本

**.gitignore**
- Git 忽略规则
- 排除 node_modules、上传文件等

### 文档文件

**README.md** (7KB)
- 项目介绍
- 功能列表
- 技术栈说明
- 安装部署指南
- 使用说明
- 故障排查

**docs/DEPLOYMENT.md** (10KB)
- Vultr 服务器完整部署流程
- 环境配置详解
- Nginx 配置
- SSL 证书配置
- 性能优化建议
- 故障排查指南

**docs/QUICKSTART.md** (4KB)
- 5 分钟快速启动
- 快速命令集
- 常见问题解答

## 🔑 核心功能实现

### 1. 用户认证 (server.js + main.js)

**注册流程**:
1. 前端发送 POST /api/register
2. 后端验证数据、加密密码
3. 生成 JWT Token
4. 返回用户信息和 Token

**登录流程**:
1. 前端发送 POST /api/login
2. 后端验证密码
3. 生成 JWT Token
4. 建立 Socket.IO 连接

**密码重置**:
1. 用户输入邮箱
2. 后端生成重置 Token
3. (生产环境) 发送邮件
4. 用户访问重置链接
5. 验证 Token 并更新密码

### 2. 实时通讯 (Socket.IO)

**消息发送**:
```javascript
socket.emit('send_message', {
  groupId, content, type, replyTo
})
```

**消息接收**:
```javascript
socket.on('new_message', (message) => {
  addMessageToUI(message)
})
```

**在线状态**:
- `user_online`: 用户上线
- `user_offline`: 用户下线
- 实时更新成员列表

### 3. 图片上传

**前端**:
1. 选择或粘贴图片
2. 压缩图片 (最大 1920px)
3. 上传到服务器
4. 发送图片消息

**后端**:
1. 使用 Multer 处理上传
2. 保存到 uploads/ 目录
3. 返回图片 URL

### 4. 群组管理

**权限层级**:
- 群主: 所有权限
- 管理员: 发布公告、禁言、置顶、撤回
- 普通成员: 发送消息、回复

**群组操作**:
- 创建: POST /api/groups
- 搜索: GET /api/groups/search/:id
- 加入: POST /api/groups/:id/join
- 更新公告: PUT /api/groups/:id/announcement

## 🎨 UI/UX 设计特点

### 苹果风格设计语言

1. **颜色系统**
   - 主色: #007AFF (iOS 蓝)
   - 辅色: #5856D6 (紫色)
   - 成功: #34C759 (绿色)
   - 危险: #FF3B30 (红色)

2. **圆角半径**
   - 小: 8px (按钮、输入框)
   - 中: 12px (卡片)
   - 大: 16-20px (模态框)

3. **动画效果**
   - 平滑过渡: cubic-bezier(0.4, 0, 0.2, 1)
   - 页面进入: slideUp、fadeIn
   - 消息动画: messageSlideIn
   - 悬停效果: 轻微缩放、阴影变化

4. **排版**
   - 字体: -apple-system, SF Pro Display
   - 字重: 300-700
   - 行高: 1.5-1.6

## 🔧 技术亮点

### 1. 多标签页同步

使用 `localStorage` 事件监听:
```javascript
window.addEventListener('storage', (e) => {
  if (e.key === 'token') {
    // 同步登录状态
  }
})
```

### 2. 断线重连

Socket.IO 自动重连:
```javascript
socket.on('connect', () => {
  socket.emit('authenticate', token)
})
```

### 3. 智能滚动

仅在底部时自动滚动:
```javascript
if (isAtBottom) {
  scrollToBottom()
}
```

### 4. 图片压缩

Canvas API 压缩:
```javascript
canvas.toBlob(blob => {
  // 压缩为 JPEG, 质量 80%
}, 'image/jpeg', 0.8)
```

## 📊 性能考虑

### 前端优化

- 图片懒加载
- 消息列表虚拟滚动 (可扩展)
- Debounce 输入事件
- LocalStorage 缓存

### 后端优化

- JWT 无状态认证
- Socket.IO 房间机制
- 文件上传大小限制
- PM2 集群模式

## 🔒 安全性

- 密码 bcrypt 加密
- JWT Token 认证
- XSS 防护 (HTML 转义)
- CSRF 保护 (可扩展)
- 文件类型验证
- 文件大小限制

## 🚀 可扩展性

### 数据库集成

当前使用内存数据库,可轻松替换为:
- MongoDB
- PostgreSQL
- MySQL

### 功能扩展

- 语音/视频通话
- 文件共享
- 消息搜索
- @提及功能
- 消息已读状态
- 群组角色管理
- 私聊功能

## 📈 部署规模

**适用场景**:
- 小型团队协作 (10-100 人)
- 社区聊天室 (100-1000 人)
- 企业内部通讯

**性能预估** (1 核 2GB 服务器):
- 并发用户: ~500
- 每秒消息: ~100
- 存储图片: ~1000 张

---

**最后更新**: 2026-01-30
