# 🚀 现代化网页聊天室

一个功能完整、设计精美的实时聊天应用,采用 Socket.IO 实现即时通讯。

![Chat Room](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ 核心功能

### 🔐 用户身份与安全系统
- ✅ 用户注册与登录
- ✅ 密码加密存储 (bcrypt)
- ✅ JWT Token 认证
- ✅ 忘记密码功能(邮箱验证)
- ✅ 断线自动重连
- ✅ 多标签页状态同步

### 💬 聊天功能
- ✅ 实时消息发送与接收
- ✅ 文本消息
- ✅ 图片发送(支持粘贴上传)
- ✅ 图片自动压缩
- ✅ Emoji 表情面板
- ✅ 引用回复
- ✅ 消息编辑
- ✅ 消息撤回
- ✅ 消息置顶
- ✅ 正在输入提示
- ✅ 智能滚动

### 👥 群组管理
- ✅ 创建群组
- ✅ 通过 7 位 ID 加入群组
- ✅ 群主/管理员权限系统
- ✅ 群公告发布
- ✅ 全员禁言模式
- ✅ 实时成员列表
- ✅ 在线/离线状态显示

### 🎨 用户体验
- ✅ 苹果风格设计
- ✅ 流畅动画效果
- ✅ 响应式布局
- ✅ 暗色模式支持(可扩展)

## 🛠️ 技术栈

### 后端
- **Node.js** - 运行环境
- **Express** - Web 框架
- **Socket.IO** - 实时通讯
- **bcryptjs** - 密码加密
- **jsonwebtoken** - JWT 认证
- **Multer** - 文件上传

### 前端
- **原生 JavaScript** - 无框架依赖
- **Socket.IO Client** - WebSocket 客户端
- **CSS3** - 现代化样式
- **HTML5** - 语义化标签

## 📦 安装部署

### 本地开发

1. **克隆仓库**
```bash
git clone <your-repo-url>
cd chat-room
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发服务器**
```bash
npm run dev
```

4. **访问应用**
打开浏览器访问: `http://localhost:3000`

### 生产环境

1. **安装依赖**
```bash
npm install --production
```

2. **配置环境变量**
创建 `.env` 文件:
```env
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=production
```

3. **启动服务**
```bash
npm start
```

## 🚀 部署到 Vultr

### 1. 准备服务器

登录 Vultr 服务器:
```bash
ssh root@your-server-ip
```

### 2. 安装 Node.js

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js (使用 NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

### 3. 安装 PM2

```bash
sudo npm install -g pm2
```

### 4. 部署应用

```bash
# 克隆代码
cd /var/www
git clone <your-repo-url> chat-room
cd chat-room

# 安装依赖
npm install --production

# 创建环境变量
nano .env
# 添加以下内容:
# PORT=3000
# JWT_SECRET=your-production-secret-key

# 使用 PM2 启动
pm2 start server.js --name duorenliaotian3

# 设置开机自启
pm2 startup
pm2 save
```

### 5. 配置 Nginx (可选)

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/chat-room

# 添加以下配置:
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/chat-room /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 6. 配置防火墙

```bash
# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许 SSH (如果还没有)
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw enable
```

### 7. 配置 SSL (使用 Let's Encrypt)

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 📝 常用命令

### PM2 管理
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs duorenliaotian3

# 重启应用
pm2 restart duorenliaotian3

# 停止应用
pm2 stop duorenliaotian3

# 删除应用
pm2 delete duorenliaotian3
```

### 更新应用
```bash
cd /var/www/chat-room
git pull
npm install --production
pm2 restart duorenliaotian3
```

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `JWT_SECRET` | JWT 密钥 | `your-secret-key-change-this-in-production` |
| `NODE_ENV` | 运行环境 | `development` |

### 文件上传限制

- 最大文件大小: 5MB
- 支持格式: JPEG, JPG, PNG, GIF, WebP
- 自动压缩: 最大尺寸 1920px

## 🎯 使用说明

### 注册账号
1. 点击"立即注册"
2. 填写用户名、邮箱和密码
3. 点击"注册"按钮

### 创建群组
1. 登录后点击"创建群组"
2. 输入群组名称和描述
3. 点击"创建"

### 加入群组
1. 点击"加入群组"
2. 输入 7 位群组 ID
3. 点击"搜索"查看群组信息
4. 点击"加入"

### 发送消息
- **文本**: 直接在输入框输入并按回车
- **图片**: 点击图片按钮或直接粘贴(Ctrl+V)
- **Emoji**: 点击笑脸按钮选择表情

### 管理员功能
- **编辑公告**: 点击群组信息 → 编辑群公告
- **全员禁言**: 点击群组信息 → 开启/关闭全员禁言
- **置顶消息**: 鼠标悬停消息 → 点击"置顶"
- **撤回消息**: 管理员可以撤回任何人的消息

## 🐛 故障排查

### 无法连接 Socket.IO
- 检查防火墙设置
- 确保 Nginx 正确配置了 WebSocket 代理
- 查看浏览器控制台错误信息

### 图片上传失败
- 检查 `server/uploads` 目录权限
- 确认图片大小不超过 5MB
- 查看服务器日志: `pm2 logs duorenliaotian3`

### 忘记密码功能不工作
- 在生产环境需要配置 SMTP 邮件服务
- 开发环境下查看控制台输出的重置链接

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📧 联系方式

如有问题,请通过以下方式联系:
- 提交 GitHub Issue
- 发送邮件至: [your-email@example.com]

---

⭐ 如果这个项目对你有帮助,请给一个星标!
