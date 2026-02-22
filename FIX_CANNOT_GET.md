# 修复 "Cannot GET" 错误指南

如果您访问网站显示 `Cannot GET /`，通常是因为网站文件没有正确生成（编译）。请按照以下步骤修复。

## 第一步：连接服务器

使用阿里云 Workbench 或 SSH 工具连接到您的服务器。

## 第二步：进入项目目录

```bash
cd /root/crypto-intel-ai
```
*(如果您上传到了其他目录，请进入相应目录)*

## 第三步：重新安装与编译 (关键)

请依次执行以下命令，不要跳过：

1. **停止当前服务**
   ```bash
   pm2 stop news-app
   pm2 delete news-app
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **重新编译项目** (这一步会生成 `dist` 文件夹，这是网站的实际内容)
   ```bash
   npm run build
   ```
   *注意：如果这一步报错，请检查是否内存不足。如果是 2G 内存的机器，通常没问题。*

4. **检查 dist 目录是否存在**
   ```bash
   ls -l dist/index.html
   ```
   *如果显示文件信息，说明编译成功。如果显示 "No such file"，说明上一步编译失败了。*

## 第四步：重新启动服务

```bash
# 启动服务
pm2 start npm --name "news-app" -- start

# 保存状态
pm2 save
```

## 第五步：验证

1. **查看日志** (检查是否有报错)
   ```bash
   pm2 logs news-app --lines 50
   ```
   *您应该能看到 "Server running on http://0.0.0.0:3001" 和 "✅ Serving static files from..." 的字样。*

2. **再次访问浏览器**
   刷新您的网页：`http://47.83.123.104:3001/`

---

## 如果还是不行？

请尝试运行我为您准备的自动修复脚本：

```bash
bash fix_deploy.sh
```
