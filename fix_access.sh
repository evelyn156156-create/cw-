#!/bin/bash
# fix_access.sh

APP_DIR="/root/cw-"
cd $APP_DIR || { echo "❌ 找不到目录 $APP_DIR"; exit 1; }

echo "========================================"
echo "🔍 CryptoIntel AI - 访问故障修复工具"
echo "========================================"

# 1. 检查前端文件
echo "Checking frontend files..."
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "⚠️ 发现 dist 目录缺失或不完整，正在重新编译..."
    # 增加内存限制防止编译崩溃
    export NODE_OPTIONS="--max-old-space-size=2048"
    npm install && npm run build
    
    if [ ! -d "dist" ]; then
        echo "❌ 编译失败！请检查服务器内存是否足够。"
        exit 1
    fi
    echo "✅ 编译完成"
else
    echo "✅ 前端文件 (dist) 检查正常"
fi

# 2. 检查并配置系统防火墙
echo "Checking firewall..."
if command -v firewall-cmd &> /dev/null && systemctl is-active --quiet firewalld; then
    echo "🔧 正在配置 firewalld..."
    firewall-cmd --zone=public --add-port=3001/tcp --permanent
    firewall-cmd --reload
    echo "✅ 系统防火墙 3001 端口已开放"
else
    echo "ℹ️ 系统防火墙未运行或未安装 (这通常没问题，只要阿里云安全组开了就行)"
fi

# 3. 重启服务
echo "🔄 重启服务..."
pm2 restart my-ai-bot
pm2 save

# 4. 等待服务启动
echo "⏳ 等待服务启动 (5秒)..."
sleep 5

# 5. 本地连通性测试
echo "Testing local connectivity..."
HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}\n" http://127.0.0.1:3001)

if [ "$HTTP_CODE" == "200" ]; then
    echo "========================================"
    echo "✅ 服务在服务器内部运行正常！(HTTP 200)"
    echo "========================================"
    echo "🚨 如果您在浏览器仍然打不开，原因只有一个："
    echo "👉 【阿里云安全组】拦截了 3001 端口"
    echo ""
    echo "请务必执行以下操作："
    echo "1. 登录阿里云 ECS 控制台"
    echo "2. 找到本实例 -> 安全组 -> 配置规则"
    echo "3. 入方向 -> 手动添加 -> 端口范围: 3001 -> 授权对象: 0.0.0.0/0"
    echo "========================================"
else
    echo "========================================"
    echo "❌ 服务内部测试失败 (状态码: $HTTP_CODE)"
    echo "========================================"
    echo "正在打印最后 30 行错误日志，请截图发给我："
    echo "----------------------------------------"
    pm2 logs my-ai-bot --lines 30 --nostream
    echo "----------------------------------------"
fi
