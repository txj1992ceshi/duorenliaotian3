# 🚀 Vultr 服务器部署完整指南

本文档详细说明如何将聊天室应用部署到 Vultr 服务器。

## 📋 前提条件

1. **Vultr 账号** - 已注册并购买服务器
2. **域名** (可选) - 用于绑定服务器
3. **Git 仓库** - 代码已上传到 GitHub/GitLab

## 🖥️ 第一步: 创建 Vultr 服务器

### 1.1 登录 Vultr 控制台

访问 [Vultr](https://www.vultr.com) 并登录你的账号。

### 1.2 部署新服务器

1. 点击右上角 "Deploy" 按钮
2. 选择服务器类型: **Cloud Compute**
3. 选择服务器位置: 推荐选择 **Tokyo** 或 **Singapore** (亚洲用户)
4. 选择操作系统: **Ubuntu 22.04 LTS**
5. 选择服务器配置:
   - 最低配置: $6/月 (1 CPU, 1GB RAM, 25GB SSD)
   - 推荐配置: $12/月 (1 CPU, 2GB RAM, 55GB SSD)
6. 添加 SSH 密钥 (推荐) 或使用密码
7. 点击 "Deploy Now"

### 1.3 等待服务器启动

服务器通常在 2-5 分钟内完成部署。记录下:
- **IP 地址**: 例如 `45.77.123.456`
- **用户名**: `root`
- **密码**: 如果没有使用 SSH 密钥

## 🔐 第二步: 连接到服务器

### Windows 用户

使用 PuTTY 或 PowerShell:
```powershell
ssh root@your-server-ip
```

### Mac/Linux 用户

打开终端:
```bash
ssh root@your-server-ip
```

首次连接会提示是否信任服务器,输入 `yes`。

## 🛠️ 第三步: 配置服务器环境

### 3.1 更新系统

```bash
# 更新软件包列表
sudo apt update

# 升级已安装的软件包
sudo apt upgrade -y

# 安装必要工具
sudo apt install -y curl git build-essential
```

### 3.2 安装 Node.js

```bash
# 添加 NodeSource 仓库 (Node.js 18.x)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# 安装 Node.js 和 npm
sudo apt install -y nodejs

# 验证安装
node --version  # 应该显示 v18.x.x
npm --version   # 应该显示 9.x.x
```

### 3.3 安装 PM2

PM2 是一个进程管理器,用于保持应用持续运行。

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
```

### 3.4 安装 Nginx

Nginx 用作反向代理服务器。

```bash
# 安装 Nginx
sudo apt install -y nginx

# 启动 Nginx
sudo systemctl start nginx

# 设置开机自启
sudo systemctl enable nginx

# 检查状态
sudo systemctl status nginx
```

### 3.5 配置防火墙

```bash
# 允许 OpenSSH
sudo ufw allow OpenSSH

# 允许 Nginx (HTTP 和 HTTPS)
sudo ufw allow 'Nginx Full'

# 启用防火墙
sudo ufw enable

# 查看防火墙状态
sudo ufw status
```

## 📦 第四步: 部署应用

### 4.1 创建应用目录

```bash
# 创建 www 目录
sudo mkdir -p /var/www

# 进入目录
cd /var/www
```

### 4.2 克隆代码

```bash
# 如果是公开仓库
sudo git clone https://github.com/your-username/chat-room.git

# 如果是私有仓库,需要先配置 SSH 密钥
# 1. 生成密钥
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 2. 查看公钥
cat ~/.ssh/id_rsa.pub

# 3. 将公钥添加到 GitHub/GitLab 的 SSH 密钥设置中

# 4. 克隆私有仓库
sudo git clone git@github.com:your-username/chat-room.git
```

### 4.3 安装依赖

```bash
cd chat-room

# 安装生产环境依赖
sudo npm install --production
```

### 4.4 配置环境变量

```bash
# 创建 .env 文件
sudo nano .env
```

添加以下内容:
```env
PORT=3000
JWT_SECRET=your-super-secure-random-secret-key-here
NODE_ENV=production
```

保存并退出 (Ctrl+X, 然后 Y, 然后 Enter)。

**重要**: 务必更改 `JWT_SECRET` 为一个随机的强密码!

生成随机密钥:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.5 创建上传目录

```bash
sudo mkdir -p server/uploads
sudo chmod 755 server/uploads
```

## 🚀 第五步: 启动应用

### 5.1 使用 PM2 启动

```bash
# 启动应用
pm2 start server.js --name duorenliaotian3

# 查看状态
pm2 status

# 查看日志
pm2 logs duorenliaotian3

# 设置开机自启
pm2 startup
# 复制输出的命令并执行

# 保存当前进程列表
pm2 save
```

### 5.2 测试应用

```bash
# 测试服务是否运行
curl http://localhost:3000
```

应该看到 HTML 响应。

## 🌐 第六步: 配置 Nginx

### 6.1 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/chat-room
```

添加以下配置 (如果没有域名,将 `your-domain.com` 替换为服务器 IP):

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 或者使用 IP: 45.77.123.456

    # 客户端最大上传大小
    client_max_body_size 10M;

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 主应用代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO 专用代理
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket 超时设置
        proxy_read_timeout 86400;
    }
}
```

### 6.2 启用站点

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/chat-room /etc/nginx/sites-enabled/

# 删除默认站点 (可选)
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 如果测试通过,重启 Nginx
sudo systemctl restart nginx
```

### 6.3 测试访问

在浏览器中访问:
- 如果使用域名: `http://your-domain.com`
- 如果使用 IP: `http://45.77.123.456`

应该可以看到登录页面!

## 🔒 第七步: 配置 HTTPS (可选但推荐)

### 7.1 安装 Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 获取 SSL 证书

```bash
# 使用域名获取证书
sudo certbot --nginx -d your-domain.com

# 如果有 www 子域名
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

按照提示:
1. 输入邮箱地址
2. 同意服务条款
3. 选择是否重定向 HTTP 到 HTTPS (推荐选择 2: Redirect)

### 7.3 测试自动续期

```bash
sudo certbot renew --dry-run
```

证书会在过期前自动续期。

## 🎯 第八步: 域名配置 (如果使用域名)

### 8.1 添加 DNS 记录

在你的域名管理面板中:

1. 添加 A 记录:
   - **名称**: `@` (或者留空)
   - **类型**: `A`
   - **值**: 你的服务器 IP (例如 `45.77.123.456`)
   - **TTL**: `3600` (1小时)

2. (可选) 添加 www 子域名:
   - **名称**: `www`
   - **类型**: `CNAME`
   - **值**: `your-domain.com`
   - **TTL**: `3600`

### 8.2 等待 DNS 传播

DNS 更新可能需要几分钟到几小时。检查传播状态:

```bash
# 检查 DNS
nslookup your-domain.com

# 或使用在线工具
# https://dnschecker.org
```

## ✅ 第九步: 验证部署

### 9.1 功能测试清单

- [ ] 访问网站正常显示
- [ ] 用户注册功能正常
- [ ] 用户登录功能正常
- [ ] 创建群组功能正常
- [ ] 发送消息功能正常
- [ ] 上传图片功能正常
- [ ] Socket.IO 实时通讯正常
- [ ] HTTPS 加密连接正常 (如果配置了)

### 9.2 性能测试

```bash
# 检查内存使用
free -h

# 检查磁盘使用
df -h

# 检查 PM2 进程
pm2 monit
```

## 🔧 常用维护命令

### 查看日志

```bash
# PM2 日志
pm2 logs duorenliaotian3

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 系统日志
sudo journalctl -u nginx -f
```

### 更新应用

```bash
cd /var/www/chat-room

# 拉取最新代码
sudo git pull

# 安装新依赖 (如果有)
sudo npm install --production

# 重启应用
pm2 restart duorenliaotian3
```

### 备份数据

```bash
# 备份整个应用目录
sudo tar -czf chat-room-backup-$(date +%Y%m%d).tar.gz /var/www/chat-room

# 下载备份到本地
# 在本地电脑执行:
scp root@your-server-ip:/root/chat-room-backup-*.tar.gz ./
```

### 监控资源

```bash
# 实时监控
htop

# 如果没有 htop
sudo apt install -y htop
```

## 🐛 故障排查

### 问题 1: 无法访问网站

**检查步骤**:
```bash
# 1. 检查 PM2 应用是否运行
pm2 status

# 2. 检查 Nginx 状态
sudo systemctl status nginx

# 3. 检查端口是否监听
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :3000

# 4. 检查防火墙
sudo ufw status
```

### 问题 2: Socket.IO 连接失败

**检查步骤**:
```bash
# 1. 查看浏览器控制台错误
# 2. 检查 Nginx 配置是否包含 Socket.IO 代理
sudo nginx -t

# 3. 查看 Nginx 错误日志
sudo tail -n 50 /var/log/nginx/error.log

# 4. 重启 Nginx
sudo systemctl restart nginx
```

### 问题 3: 图片上传失败

**检查步骤**:
```bash
# 1. 检查上传目录权限
ls -la /var/www/chat-room/server/uploads

# 2. 修复权限
sudo chmod 755 /var/www/chat-room/server/uploads

# 3. 检查 Nginx 上传大小限制
# 确保 nginx.conf 中有 client_max_body_size 10M;
```

### 问题 4: 内存不足

**解决方案**:
```bash
# 1. 添加 Swap 空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 2. 永久启用
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. 重启 PM2 应用
pm2 restart duorenliaotian3
```

## 📊 性能优化

### 启用 Gzip 压缩

编辑 Nginx 配置:
```bash
sudo nano /etc/nginx/nginx.conf
```

在 `http` 块中添加:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
```

### PM2 集群模式

```bash
# 停止当前进程
pm2 delete duorenliaotian3

# 使用集群模式启动 (使用所有 CPU 核心)
pm2 start server.js --name duorenliaotian3 -i max

# 保存配置
pm2 save
```

## 🎉 完成!

恭喜!你的聊天室应用已成功部署到 Vultr 服务器。

记住:
- 定期更新系统和应用
- 监控服务器资源使用情况
- 定期备份重要数据
- 查看日志以发现潜在问题

如有问题,请参考故障排查部分或查看完整的 README.md 文档。
