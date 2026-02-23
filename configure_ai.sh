#!/bin/bash

echo "========================================"
echo "🤖 CryptoIntel AI - 配置 AI API Key"
echo "========================================"
echo ""
echo "请输入您的 Google Gemini API Key:"
read -p "> " API_KEY

if [ -z "$API_KEY" ]; then
  echo "❌ API Key 不能为空"
  exit 1
fi

echo ""
echo "正在配置环境变量并重启服务..."

# 使用 pm2 设置环境变量并重启
# --update-env 会更新进程的环境变量
GEMINI_API_KEY="$API_KEY" pm2 restart my-ai-bot --update-env

# 保存当前进程列表和环境配置
pm2 save

echo ""
echo "✅ 配置完成！"
echo "现在您可以去网页上点击 'AI 深度分析' 按钮了。"
