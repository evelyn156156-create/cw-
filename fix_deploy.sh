#!/bin/bash

# 阿里云 ECS 部署修复脚本
# 作用：开放系统防火墙端口、重启服务

echo "=========================================="
echo "   CryptoIntel AI - 自动修复工具"
echo "=========================================="

# 1. 检查并安装 firewalld (如果未安装)
if ! command -v firewall-cmd &> /dev/null; then
    echo "正在安装防火墙管理工具..."
    sudo dnf install -y firewalld
    sudo systemctl start firewalld
    sudo systemctl enable firewalld
fi

# 2. 开放 3001 端口 (解决系统防火墙拦截)
echo "正在开放系统防火墙 3001 端口..."
sudo firewall-cmd --zone=public --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
echo "✅ 系统防火墙端口 3001 已开放"

# 3. 重新编译项目 (防止之前编译失败)
echo "正在重新编译项目..."
cd /root/crypto-intel-ai || exit
npm install
npm run build

# 4. 重启 PM2 服务
echo "正在重启应用服务..."
pm2 delete "news-app" 2>/dev/null
pm2 start npm --name "news-app" -- start
pm2 save

echo "=========================================="
echo "✅ 修复完成！"
echo "请务必检查【阿里云控制台】的安全组是否也开放了 3001 端口。"
echo "访问地址: http://$(curl -s ifconfig.me):3001"
echo "=========================================="
