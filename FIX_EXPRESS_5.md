# 修复 Express 5 路由报错指南

**问题原因：**
您的项目使用了最新版的 Express 5.x，它对路由通配符的写法有了更严格的要求。旧的写法 `app.get('*')` 或 `app.get('(.*)')` 会导致 `PathError` 报错，从而使服务无法启动。

**解决方案：**
我已经修改了 `server.ts` 文件，将通配符路由改为正则表达式 `/.*/`，这是 Express 5 推荐的写法。

## 如何应用修复

请在服务器终端执行以下命令来重启服务：

```bash
pm2 restart my-ai-bot
```

## 验证修复

1. 查看日志，确认不再报错：
   ```bash
   pm2 logs my-ai-bot --lines 50
   ```
   *您应该能看到 "Server running on http://0.0.0.0:3001" 的字样，且没有 PathError 错误。*

2. 访问网站：
   `http://47.83.123.104:3001/`

---

## 如果您想手动确认代码更改

您可以查看 `server.ts` 的末尾部分，确保它是这样的：

```typescript
// 2. SPA 路由回退 (让所有非 API 请求都返回 index.html)
// 注意: Express 5 中使用正则 /.*/ 匹配所有路径
app.get(/.*/, (req, res, next) => {
  // ...
});
```
