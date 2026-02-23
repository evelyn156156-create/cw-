# 如何配置 AI API Key

您点击 "AI 分析" 没有反应，是因为服务器还没有配置 Google Gemini 的 API Key。

我已经为您准备了一个简单的配置脚本。

## 第一步：获取 API Key

如果您还没有 API Key，请先去申请：
[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

## 第二步：运行配置脚本

在服务器终端运行以下命令：

```bash
cd /root/cw-
bash configure_ai.sh
```

按照提示输入您的 API Key（以 `AIza` 开头的字符串），回车即可。

## 第三步：验证

1. 配置完成后，脚本会自动重启服务。
2. 回到网页，点击 **"AI 深度分析"**。
3. 您应该能看到日志显示 "🤖 开始 AI 分析..."，稍等片刻后会显示 "✅ 分析完成"。

---

## 手动配置方法 (备选)

如果您不想用脚本，也可以手动运行命令：

```bash
GEMINI_API_KEY="您的API_KEY_粘贴在这里" pm2 restart my-ai-bot --update-env
pm2 save
```
