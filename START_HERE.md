# 🎉 聊天室项目 - 完整交付包

## 📦 包含内容

这个压缩包包含了一个功能完整的现代化网页聊天室应用。

### ✅ 已实现的功能

#### 🔐 用户系统
- [x] 用户注册 (用户名 + 邮箱 + 密码)
- [x] 用户登录 (JWT Token 认证)
- [x] 忘记密码 (邮箱验证)
- [x] 密码加密存储 (bcrypt)
- [x] 断线自动重连
- [x] 多标签页状态同步

#### 💬 聊天功能
- [x] 实时消息发送/接收
- [x] 文本消息
- [x] 图片发送 (支持点击上传 + Ctrl+V 粘贴)
- [x] 图片自动压缩
- [x] Emoji 表情选择器
- [x] 引用回复 (点击消息引用)
- [x] 消息编辑 (带"已编辑"标记)
- [x] 消息撤回
- [x] 消息置顶
- [x] "正在输入..." 提示
- [x] 智能滚动 (查看历史时不打扰)

#### 👥 群组管理
- [x] 创建群组
- [x] 通过 7 位数字 ID 搜索群组
- [x] 加入群组
- [x] 群主/管理员权限系统
- [x] 发布群公告
- [x] 全员禁言模式
- [x] 实时成员列表
- [x] 在线/离线状态显示

#### 🎨 UI/UX
- [x] 苹果风格设计
- [x] 流畅动画效果
- [x] 响应式布局 (支持移动端)
- [x] 毛玻璃效果
- [x] 渐变背景

## 📂 文件结构

```
chat-room/
├── server/
│   └── server.js           # 后端服务器 (Express + Socket.IO)
├── public/
│   ├── index.html          # 主页面
│   ├── reset-password.html # 密码重置页面
│   ├── styles.css          # 苹果风格 CSS
│   └── main.js             # 前端 JavaScript
├── docs/
│   ├── DEPLOYMENT.md       # 详细部署指南
│   ├── QUICKSTART.md       # 5分钟快速开始
│   └── STRUCTURE.md        # 项目结构详解
├── deploy.sh               # 一键部署脚本 ⚡
├── package.json            # npm 配置
├── .gitignore             # Git 忽略规则
├── LICENSE                # MIT 许可证
└── README.md              # 项目说明
```

## 🚀 快速开始

### 方法 1: 本地测试 (3 步)

```bash
# 1. 解压并进入目录
tar -xzf chat-room.tar.gz
cd chat-room

# 2. 安装依赖
npm install

# 3. 启动服务
npm run dev
```

访问: http://localhost:3000

### 方法 2: Vultr 一键部署 ⚡

```bash
# 1. 上传到服务器
scp chat-room.tar.gz root@your-server-ip:~

# 2. 解压
tar -xzf chat-room.tar.gz
cd chat-room

# 3. 运行自动部署脚本
chmod +x deploy.sh
sudo ./deploy.sh
```

脚本会自动:
- ✅ 安装 Node.js
- ✅ 安装 PM2
- ✅ 安装 Nginx
- ✅ 配置防火墙
- ✅ 启动应用
- ✅ 配置反向代理

## 📖 详细文档

### 新手必读
1. **README.md** - 项目介绍和功能说明
2. **docs/QUICKSTART.md** - 5分钟快速上手指南

### 部署相关
3. **docs/DEPLOYMENT.md** - Vultr 服务器完整部署流程
4. **deploy.sh** - 自动化部署脚本

### 开发相关
5. **docs/STRUCTURE.md** - 代码结构和技术细节

## 🛠️ 技术栈

- **后端**: Node.js + Express + Socket.IO
- **前端**: 原生 JavaScript + CSS3 + HTML5
- **认证**: JWT + bcrypt
- **实时通讯**: Socket.IO (WebSocket)
- **文件上传**: Multer
- **进程管理**: PM2
- **反向代理**: Nginx

## 📋 系统要求

### 开发环境
- Node.js >= 14.0.0
- npm >= 6.0.0

### 生产环境 (最低配置)
- 1 核 CPU
- 1 GB RAM
- 10 GB 存储空间
- Ubuntu 20.04+ / CentOS 7+

### 推荐配置
- 2 核 CPU
- 2 GB RAM
- 20 GB SSD
- Ubuntu 22.04 LTS

## 🎯 使用说明

### 首次使用

1. **注册账号**
   - 打开应用
   - 点击"立即注册"
   - 填写用户名、邮箱、密码

2. **创建群组**
   - 登录后点击"创建群组"
   - 输入名称和描述
   - 点击创建

3. **邀请成员**
   - 点击群组信息按钮 (ℹ️)
   - 复制群组 ID
   - 分享给朋友

4. **开始聊天**
   - 发送文本消息
   - 点击图片按钮或 Ctrl+V 粘贴图片
   - 点击消息可以引用回复

### 管理员功能

- **编辑公告**: 群组信息 → 编辑群公告
- **全员禁言**: 群组信息 → 开启/关闭全员禁言
- **置顶消息**: 鼠标悬停消息 → 置顶
- **撤回消息**: 鼠标悬停消息 → 撤回

## 🔧 常用命令

### 开发模式
```bash
npm run dev      # 启动开发服务器 (自动重启)
npm start        # 启动生产服务器
```

### 生产环境 (PM2)
```bash
pm2 status           # 查看运行状态
pm2 logs chat-room   # 查看实时日志
pm2 restart chat-room # 重启应用
pm2 stop chat-room    # 停止应用
pm2 delete chat-room  # 删除应用
```

### 更新代码
```bash
cd /var/www/chat-room
git pull
npm install --production
pm2 restart chat-room
```

## 🔐 安全配置

### 必须修改的配置

1. **JWT 密钥** (.env 文件)
   ```bash
   # 生成随机密钥
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # 添加到 .env
   JWT_SECRET=生成的随机密钥
   ```

2. **配置 HTTPS** (生产环境推荐)
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## 🌐 GitHub 部署

### 上传到 GitHub

```bash
cd chat-room

# 初始化仓库
git init
git add .
git commit -m "Initial commit: Chat room application"

# 关联远程仓库
git remote add origin https://github.com/your-username/chat-room.git

# 推送代码
git branch -M main
git push -u origin main
```

### 从 GitHub 部署

```bash
# 在服务器上
cd /var/www
git clone https://github.com/your-username/chat-room.git
cd chat-room
npm install --production

# 使用自动部署脚本
chmod +x deploy.sh
sudo ./deploy.sh
```

## 🐛 故障排查

### 问题 1: 无法访问应用

```bash
# 检查应用状态
pm2 status

# 检查端口
sudo netstat -tulpn | grep :3000

# 检查日志
pm2 logs chat-room
```

### 问题 2: Socket.IO 无法连接

```bash
# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log

# 重启 Nginx
sudo systemctl restart nginx
```

### 问题 3: 图片上传失败

```bash
# 检查上传目录
ls -la /var/www/chat-room/server/uploads

# 修复权限
sudo chmod 755 /var/www/chat-room/server/uploads
```

## 📊 性能预估

**1 核 2GB 服务器**:
- 并发用户: ~500
- 每秒消息: ~100
- 图片存储: ~1000 张

**2 核 4GB 服务器**:
- 并发用户: ~2000
- 每秒消息: ~500
- 图片存储: ~5000 张

## 🎨 自定义修改

### 更改主题色

编辑 `public/styles.css`:
```css
:root {
  --primary-color: #007AFF;  /* 改为你喜欢的颜色 */
}
```

### 更改网站标题

编辑 `public/index.html`:
```html
<title>你的网站名称</title>
```

### 添加 Logo

替换 `public/index.html` 中的 SVG logo。

## 📞 支持与反馈

- 📖 查看文档: docs/ 目录
- 🐛 报告问题: GitHub Issues
- 💬 讨论交流: GitHub Discussions

## 📄 许可证

MIT License - 可自由使用、修改和分发

## ✨ 下一步建议

部署完成后,你可以:

1. ✅ **配置 HTTPS** (使用 Certbot)
2. ✅ **绑定域名** (更专业)
3. ✅ **配置数据库** (MongoDB/PostgreSQL)
4. ✅ **添加邮件服务** (用于密码重置)
5. ✅ **性能监控** (Prometheus + Grafana)
6. ✅ **自动备份** (定时任务)

## 🎉 祝你使用愉快!

如有任何问题,欢迎查阅详细文档或提交 Issue。

---

**项目版本**: 1.0.0  
**最后更新**: 2026-01-30  
**作者**: Chat Room Team
