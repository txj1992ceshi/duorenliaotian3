# ⚡ 快速开始指南

这是一个 5 分钟快速部署指南,帮助你快速启动聊天室应用。

## 🚀 本地开发 (3 步)

### 1️⃣ 克隆并安装

```bash
# 克隆仓库
git clone <your-repo-url>
cd chat-room

# 安装依赖
npm install
```

### 2️⃣ 启动开发服务器

```bash
npm run dev
```

### 3️⃣ 访问应用

打开浏览器访问: **http://localhost:3000**

✅ 完成! 你现在可以:
- 注册账号
- 创建群组
- 开始聊天

---

## 🌐 生产部署 (Vultr)

### 快速命令集

连接服务器后,依次执行:

```bash
# 1. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 2. 安装 PM2 和 Nginx
sudo npm install -g pm2
sudo apt install -y nginx

# 3. 克隆代码
cd /var/www
sudo git clone <your-repo-url> chat-room
cd chat-room

# 4. 安装依赖
sudo npm install --production

# 5. 配置环境变量
echo 'PORT=3000
JWT_SECRET='$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")'
NODE_ENV=production' | sudo tee .env

# 6. 启动应用
pm2 start server/server.js --name chat-room
pm2 startup
pm2 save

# 7. 配置 Nginx (需要手动编辑配置文件)
sudo nano /etc/nginx/sites-available/chat-room
# 粘贴 Nginx 配置 (见下方)

# 8. 启用站点
sudo ln -s /etc/nginx/sites-available/chat-room /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 9. 配置防火墙
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Nginx 配置模板

```nginx
server {
    listen 80;
    server_name your-ip-or-domain;

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
    }
}
```

---

## 📱 第一次使用

### 注册并创建群组

1. 访问应用地址
2. 点击"立即注册"
3. 填写信息并注册
4. 点击"创建群组"
5. 输入群组名称
6. 开始聊天!

### 邀请其他人

1. 点击群组信息 (右上角 ℹ️ 按钮)
2. 复制"群组 ID" (7位数字)
3. 分享给朋友
4. 朋友点击"加入群组",输入 ID 即可加入

---

## 🔧 常用命令

### 开发环境

```bash
npm run dev      # 启动开发服务器 (带自动重启)
npm start        # 启动生产服务器
```

### 生产环境 (PM2)

```bash
pm2 status           # 查看应用状态
pm2 logs chat-room   # 查看日志
pm2 restart chat-room # 重启应用
pm2 stop chat-room    # 停止应用
```

### 更新应用

```bash
cd /var/www/chat-room
sudo git pull
sudo npm install --production
pm2 restart chat-room
```

---

## 🆘 遇到问题?

### 常见问题

**Q: 无法访问应用?**
```bash
# 检查应用是否运行
pm2 status

# 检查 Nginx
sudo systemctl status nginx

# 查看日志
pm2 logs chat-room
```

**Q: Socket.IO 无法连接?**
- 检查 Nginx 配置中是否包含 `/socket.io/` 代理
- 确保防火墙允许 80/443 端口

**Q: 图片上传失败?**
```bash
# 检查上传目录权限
sudo chmod 755 server/uploads
```

### 获取帮助

- 📖 查看完整文档: [README.md](../README.md)
- 🚀 部署详细指南: [DEPLOYMENT.md](DEPLOYMENT.md)
- 🐛 提交 Issue: GitHub Issues

---

## 🎯 下一步

完成基础部署后,你可以:

- ✅ 配置 HTTPS (使用 Certbot)
- ✅ 绑定自定义域名
- ✅ 配置邮件服务 (用于密码重置)
- ✅ 启用数据库持久化 (MongoDB/PostgreSQL)
- ✅ 添加更多功能

详见完整文档!

---

**祝使用愉快! 🎉**
