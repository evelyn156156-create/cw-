#!/bin/bash
echo "🚀 开始全自动修复与重部署..."
cd /root/cw- || exit
echo "🛑 停止旧服务..."
pm2 delete my-ai-bot 2>/dev/null
echo "📦 安装依赖与重新编译..."
npm install && npm run build
echo "🔥 启动服务并开启外网访问..."
HOST=0.0.0.0 pm2 start "npm start" --name "my-ai-bot"
pm2 save
echo "🎉 部署完成！访问：http://47.83.123.104:3001"
