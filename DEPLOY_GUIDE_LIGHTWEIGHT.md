# 阿里云轻量应用服务器部署指南 (2vCPU 2GiB)

您选择的配置 **(2vCPU 2GiB, 40G SSD)** 非常适合运行本项目。

**⚠️ 关于默认镜像 "OpenClaw(Moltbot)" 的重要提示：**
该镜像可能预装了特定的机器人软件，环境可能不纯净，或者端口被占用。为了确保项目稳定运行，**强烈建议您在购买后，在控制台将系统重置为纯净的 Linux 系统**。

---

## 第一步：重置系统 (必做)

1. 登录 [阿里云轻量应用服务器控制台](https://swas.console.aliyun.com/)。
2. 点击您刚购买的服务器卡片进入详情页。
3. 在左侧菜单找到 **"系统设置"** -> **"重置系统"**。
4. 选择 **"系统镜像"** (不要选应用镜像)。
5. 推荐选择：**Alibaba Cloud Linux 3** (兼容 CentOS，性能优化好) 或 **Ubuntu 22.04**。
6. 设置 root 密码，确认重置。等待 1-2 分钟服务器重启。

---

## 第二步：环境安装 (以 Alibaba Cloud Linux 3 为例)

使用终端工具 (如 PowerShell, Terminal, Xshell) 连接服务器：
`ssh root@您的公网IP`

### 1. 更新并安装基础工具
```bash
yum update -y
yum install -y git curl wget unzip
```

### 2. 安装 Node.js 20
```bash
# 添加 NodeSource 源
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -

# 安装 Node.js
yum install -y nodejs

# 验证
node -v  # 应显示 v20.x.x
npm -v
```

### 3. 安装进程管理器 PM2
```bash
npm install -g pm2
```

---

## 第三步：部署项目

### 1. 上传代码
您可以使用 SFTP 工具 (如 FileZilla) 将本地项目文件上传到服务器的 `/root/crypto-intel-ai` 目录。
**注意：** 不需要上传 `node_modules` 文件夹。

### 2. 安装依赖与构建
```bash
cd /root/crypto-intel-ai

# 安装依赖
npm install

# 编译项目 (TypeScript -> JavaScript)
npm run build
```

### 3. 初始化数据库
```bash
# 确保数据库文件有写入权限
touch crypto_news.db
chmod 777 crypto_news.db
```

---

## 第四步：启动服务

使用 PM2 在后台启动服务，这样即使断开 SSH 连接，服务也会一直运行。

```bash
# 启动服务 (名称为 crypto-app)
pm2 start npm --name "crypto-app" -- start

# 查看运行状态
pm2 status

# 设置开机自启 (防止服务器重启后服务挂掉)
pm2 startup
pm2 save
```

此时，服务已经在服务器的 **3001** 端口运行。

---

## 第五步：开放防火墙端口 (关键)

1. 回到阿里云轻量应用服务器控制台。
2. 点击 **"安全"** -> **"防火墙"**。
3. 点击 **"添加规则"**：
   - 协议：TCP
   - 端口范围：**3001**
   - 限制 IP：0.0.0.0/0 (允许所有 IP 访问)
4. (可选) 如果您后续配置了 Nginx 反向代理到 80 端口，也请放行 80 端口。

---

## 第六步：访问验证

在浏览器输入：
`http://您的公网IP:3001`

您应该能看到 CryptoIntel AI 的界面了！

---

## 常用维护命令

- **查看日志**: `pm2 logs crypto-app`
- **重启服务**: `pm2 restart crypto-app`
- **停止服务**: `pm2 stop crypto-app`
