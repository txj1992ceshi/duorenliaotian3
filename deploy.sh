#!/bin/bash

# 聊天室应用自动部署脚本
# 适用于 Ubuntu 22.04 LTS

set -e  # 遇到错误立即退出

echo "======================================"
echo "  聊天室应用 - 自动部署脚本"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}请使用 root 权限运行此脚本${NC}"
   echo "使用: sudo bash deploy.sh"
   exit 1
fi

# 1. 更新系统
echo -e "${YELLOW}[1/9] 更新系统...${NC}"
apt update && apt upgrade -y
apt install -y curl git build-essential

# 2. 安装 Node.js
echo -e "${YELLOW}[2/9] 安装 Node.js 18.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node --version) 已安装${NC}"

# 3. 安装 PM2
echo -e "${YELLOW}[3/9] 安装 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo -e "${GREEN}✓ PM2 已安装${NC}"

# 4. 安装 Nginx
echo -e "${YELLOW}[4/9] 安装 Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl enable nginx
fi
echo -e "${GREEN}✓ Nginx 已安装${NC}"

# 5. 克隆或更新代码
echo -e "${YELLOW}[5/9] 准备应用代码...${NC}"
APP_DIR="/var/www/duorenliaotian3"

if [ -d "$APP_DIR" ]; then
    echo "应用目录已存在,正在更新..."
    cd $APP_DIR
    git pull || echo "Git pull 失败,请手动更新"
else
    echo "请输入 Git 仓库 URL:"
    read REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo -e "${RED}未提供仓库 URL${NC}"
        exit 1
    fi
    
    cd /var/www
    git clone $REPO_URL duorenliaotian3
    cd duorenliaotian3
fi

# 6. 安装依赖
echo -e "${YELLOW}[6/9] 安装 npm 依赖...${NC}"
npm install --production
echo -e "${GREEN}✓ 依赖已安装${NC}"

# 7. 配置环境变量
echo -e "${YELLOW}[7/9] 配置环境变量...${NC}"
if [ ! -f ".env" ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    cat > .env << EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$JWT_SECRET
APP_BASE_URL=https://lts1992.duckdns.org
MONGODB_URI=

# Cloudinary (recommended)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=

# Upload limits
# IMAGE_MAX_BYTES=5242880
# VIDEO_MAX_BYTES=20971520

# SMTP (Gmail/Google Workspace)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
EOF
    echo -e "${GREEN}✓ .env 文件已创建${NC}"
    echo -e "${YELLOW}请先编辑 .env 填入 MONGODB_URI/Cloudinary/SMTP 等配置，然后重新运行本脚本继续部署。${NC}"
    exit 0
else
    echo ".env 文件已存在,跳过..."
fi

# 8. 配置并启动 PM2
echo -e "${YELLOW}[8/9] 启动应用...${NC}"
pm2 delete duorenliaotian3 2>/dev/null || true
pm2 start server.js --name duorenliaotian3
pm2 startup
pm2 save
echo -e "${GREEN}✓ 应用已启动${NC}"

# 9. 配置 Nginx
echo -e "${YELLOW}[9/9] 配置 Nginx...${NC}"

# 获取服务器 IP 或域名
read -p "请输入域名 (留空使用服务器 IP): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(curl -s ifconfig.me)
    echo "使用 IP 地址: $DOMAIN"
fi

# 创建 Nginx 配置
cat > /etc/nginx/sites-available/duorenliaotian3 << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    client_max_body_size 25M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/duorenliaotian3 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试并重启 Nginx
nginx -t
systemctl restart nginx

echo -e "${GREEN}✓ Nginx 已配置${NC}"

# 10. 配置防火墙
echo -e "${YELLOW}配置防火墙...${NC}"
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

echo ""
echo "======================================"
echo -e "${GREEN}部署完成!${NC}"
echo "======================================"
echo ""
echo "访问地址: http://$DOMAIN"
echo ""
echo "常用命令:"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs duorenliaotian3"
echo "  重启应用: pm2 restart duorenliaotian3"
echo ""
echo "配置 HTTPS (可选):"
echo "  sudo apt install -y certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d $DOMAIN"
echo ""
echo "======================================"
