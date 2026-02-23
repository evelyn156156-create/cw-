# 修复 "黑屏" 问题指南

黑屏通常是因为浏览器加载不到 JavaScript 文件，或者 JavaScript 运行报错。

## 第一步：应用服务器修复

我已经优化了服务器代码，防止静态资源加载失败时返回 HTML（这会导致 "Unexpected token <" 错误）。

请在服务器终端执行：

```bash
# 1. 更新服务器代码 (我已经自动修改了 server.ts，您只需要重启)
pm2 restart my-ai-bot

# 2. 强制重新编译前端 (确保文件完整)
npm run build
```

## 第二步：浏览器排查 (关键)

如果重启后仍然黑屏，请按以下步骤操作，并把截图发给我：

1. **打开浏览器控制台**
   - 在黑屏页面，按 `F12` 或右键点击 -> "检查" (Inspect)。
   - 切换到 **"Console" (控制台)** 标签页。

2. **查看红色报错**
   - 您应该能看到红色的错误信息。
   - 常见错误及含义：
     - `Uncaught SyntaxError: Unexpected token '<'` -> 说明 JS 文件路径不对，服务器返回了 HTML。
     - `Failed to load resource: net::ERR_CONNECTION_REFUSED` -> 说明服务没启动或端口被防火墙拦截。
     - `ReferenceError: process is not defined` -> 代码中使用了环境变量但没配置好。

3. **查看网络请求**
   - 切换到 **"Network" (网络)** 标签页。
   - 刷新页面。
   - 看看 `index.js` 或 `index.css` 是否是红色 (404 或 500)。

## 第三步：检查 dist 目录

在服务器上运行以下命令，确保前端文件已生成：

```bash
ls -R dist
```
*您应该能看到 `index.html` 和 `assets` 文件夹。*
