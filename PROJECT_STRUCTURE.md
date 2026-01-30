# 📁 项目结构说明

```
chatroom/
├── 📄 README.md              # 项目说明文档
├── 📄 QUICKSTART.md          # 快速启动指南
├── 📄 package.json           # 项目依赖配置
├── 📄 .env.example           # 环境变量示例
├── 📄 .gitignore            # Git 忽略配置
├── 🔧 deploy.sh             # 自动部署脚本
│
├── 📁 public/               # 前端静态文件
│   ├── 📄 index.html        # 主页面
│   │
│   ├── 📁 css/              # 样式文件
│   │   └── 📄 style.css     # 主样式文件（苹果风格设计）
│   │
│   ├── 📁 js/               # JavaScript 文件
│   │   ├── 📄 config.js     # 配置文件
│   │   ├── 📄 api.js        # API 请求模块
│   │   ├── 📄 socket.js     # Socket.IO 连接管理
│   │   ├── 📄 ui.js         # UI 管理模块
│   │   └── 📄 main.js       # 主应用逻辑
│   │
│   └── 📁 uploads/          # 上传文件存储目录
│
├── 📁 server/               # 后端服务器
│   ├── 📄 server.js         # 服务器入口文件
│   ├── 📄 database.js       # 数据库模块（SQLite）
│   ├── 📄 socket.js         # Socket.IO 事件处理
│   │
│   ├── 📁 middleware/       # 中间件
│   │   └── 📄 auth.js       # 认证中间件
│   │
│   └── 📁 routes/           # API 路由
│       ├── 📄 auth.js       # 认证路由
│       ├── 📄 groups.js     # 群组路由
│       ├── 📄 messages.js   # 消息路由
│       └── 📄 upload.js     # 文件上传路由
│
└── 📁 data/                 # 数据存储目录
    └── 📄 chatroom.db       # SQLite 数据库文件
```

## 📋 文件说明

### 前端文件

#### `public/index.html`
- 主 HTML 文件
- 包含登录/注册界面
- 聊天主界面
- 各种模态框（创建群组、加入群组、设置等）

#### `public/css/style.css`
- 苹果风格设计的完整样式
- CSS 变量系统
- 响应式布局
- 精美的动画效果
- 暗色模式支持

#### `public/js/config.js`
- 应用配置
- API 地址
- Socket.IO 配置
- Emoji 列表
- 图片压缩参数

#### `public/js/api.js`
- RESTful API 封装
- Token 管理
- 用户认证
- 群组管理
- 消息操作
- 文件上传

#### `public/js/socket.js`
- Socket.IO 连接管理
- 实时消息推送
- 在线状态管理
- 输入状态提示
- 消息编辑/删除
- 断线重连

#### `public/js/ui.js`
- DOM 操作封装
- 界面渲染
- 事件处理
- Toast 通知
- 模态框管理
- Emoji 选择器

#### `public/js/main.js`
- 主应用逻辑
- 状态管理
- 业务流程
- 图片压缩
- 粘贴处理

### 后端文件

#### `server/server.js`
- Express 服务器
- 中间件配置
- 路由挂载
- Socket.IO 初始化
- 错误处理
- 优雅关闭

#### `server/database.js`
- SQLite 数据库封装
- 表结构创建
- 通用查询方法
- 连接管理

#### `server/socket.js`
- Socket.IO 事件处理
- 实时通信逻辑
- 在线用户管理
- 消息广播
- 权限验证

#### `server/middleware/auth.js`
- JWT 认证中间件
- Token 生成/验证
- Socket 认证
- 权限检查

#### `server/routes/auth.js`
- 用户注册
- 用户登录
- 获取用户信息
- 密码加密

#### `server/routes/groups.js`
- 创建群组
- 加入群组
- 获取群组列表
- 群组详情
- 成员管理
- 群公告
- 全员禁言
- 消息置顶

#### `server/routes/messages.js`
- 发送消息
- 编辑消息
- 删除消息
- 历史消息

#### `server/routes/upload.js`
- 图片上传
- 文件类型验证
- 大小限制
- Multer 配置

## 🎯 核心功能实现

### 🔐 用户认证
- **前端**: `api.js` 中的 `login()` 和 `register()`
- **后端**: `routes/auth.js`
- **中间件**: `middleware/auth.js`
- **存储**: JWT Token 存储在 localStorage

### 💬 实时消息
- **前端**: `socket.js` 监听 `new_message` 事件
- **后端**: `socket.js` 处理 `send_message` 事件
- **数据库**: `messages` 表存储历史消息

### 👥 群组管理
- **前端**: `api.js` 群组相关方法
- **后端**: `routes/groups.js`
- **数据库**: `groups` 和 `group_members` 表

### 📸 图片上传
- **前端**: `main.js` 中的 `handleImageUpload()` 和 `compressImage()`
- **后端**: `routes/upload.js` 使用 Multer
- **存储**: `public/uploads/` 目录

### 🔔 实时通知
- **输入状态**: Socket.IO `typing` 事件
- **在线状态**: `user_online` 和 `user_offline` 事件
- **消息推送**: 服务器广播到对应群组

## 🔄 数据流程

### 用户登录流程
1. 用户在 `index.html` 输入账号密码
2. `main.js` 调用 `API.login()`
3. 请求发送到 `routes/auth.js`
4. 验证通过后返回 JWT Token
5. Token 保存到 localStorage
6. 初始化 Socket.IO 连接
7. 加载用户群组列表

### 消息发送流程
1. 用户在输入框输入内容
2. 点击发送或按 Ctrl+Enter
3. `main.js` 调用 `SocketManager.sendMessage()`
4. Socket 事件发送到服务器
5. `socket.js` 接收并验证
6. 保存到数据库
7. 广播到群组所有在线成员
8. 客户端接收并渲染消息

### 群组加入流程
1. 用户输入 7 位数字群组 ID
2. `main.js` 调用 `API.joinGroup()`
3. `routes/groups.js` 验证群组存在
4. 添加用户到 `group_members` 表
5. 返回群组信息
6. 刷新群组列表
7. 自动选中并加载消息

## 🛠️ 技术栈详解

### 前端技术
- **原生 JavaScript**: 无框架，性能优秀
- **CSS 变量**: 统一主题管理
- **Flexbox/Grid**: 响应式布局
- **LocalStorage**: 本地缓存
- **Socket.IO Client**: 实时通信

### 后端技术
- **Node.js**: 运行环境
- **Express**: Web 框架
- **Socket.IO**: WebSocket 封装
- **SQLite**: 轻量级数据库
- **JWT**: 无状态认证
- **Bcrypt**: 密码加密
- **Multer**: 文件上传

### 部署技术
- **Nginx**: 反向代理和静态文件服务
- **PM2**: 进程管理
- **Certbot**: SSL 证书
- **UFW**: 防火墙

## 📊 数据库设计

### users 表
- `id`: 主键
- `username`: 用户名（唯一）
- `password`: 加密密码
- `created_at`: 创建时间

### groups 表
- `id`: 7位数字ID（主键）
- `name`: 群组名称
- `description`: 群组描述
- `owner_id`: 群主ID
- `mute_all`: 全员禁言标记
- `announcement`: 群公告
- `pinned_message_id`: 置顶消息ID
- `created_at`: 创建时间

### group_members 表
- `id`: 主键
- `group_id`: 群组ID
- `user_id`: 用户ID
- `role`: 角色（owner/admin/member）
- `joined_at`: 加入时间

### messages 表
- `id`: 主键
- `group_id`: 群组ID
- `user_id`: 发送者ID
- `content`: 消息内容
- `type`: 消息类型（text/image）
- `reply_to`: 引用消息ID
- `edited`: 是否已编辑
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 🎨 设计特色

### 苹果风格设计
- **流畅动画**: 使用 cubic-bezier 缓动函数
- **毛玻璃效果**: backdrop-filter 模糊
- **圆角设计**: 统一的圆角系统
- **阴影层次**: 多层次阴影设计
- **渐变色彩**: 精心设计的渐变色
- **微交互**: 悬停、点击动画

### 响应式设计
- **桌面端**: 三栏布局
- **平板端**: 双栏布局
- **手机端**: 单栏布局，侧边栏抽屉

### 暗色模式
- 自动适配系统主题
- 使用 CSS 媒体查询
- 独立的暗色调色板

## 🚀 性能优化

- **代码分离**: 模块化 JavaScript
- **懒加载**: 按需加载内容
- **防抖节流**: 输入事件优化
- **虚拟滚动**: 大量消息优化（可扩展）
- **图片压缩**: 客户端自动压缩
- **Gzip 压缩**: Nginx 启用
- **静态资源缓存**: 合理的缓存策略

## 🔒 安全措施

- **JWT 认证**: 无状态身份验证
- **密码加密**: Bcrypt 哈希
- **XSS 防护**: 内容转义
- **CSRF 防护**: Token 验证
- **文件类型验证**: 只允许图片
- **文件大小限制**: 5MB 上限
- **SQL 注入防护**: 参数化查询
- **Rate Limiting**: 可添加请求频率限制
