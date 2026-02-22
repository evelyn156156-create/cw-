# 阿里云 (Alibaba Cloud Linux 3) 部署指南

Alibaba Cloud Linux 3 是完全兼容 CentOS / RHEL 的操作系统，非常适合部署本项目。

## 1. 环境准备

连接到您的服务器终端，按顺序执行以下命令：

### 更新系统
```bash
sudo dnf update -y
```

### 安装 Node.js (版本 20)
Alibaba Cloud Linux 默认源可能版本较旧，推荐使用 NodeSource 源：

```bash
# 添加 Node.js 20 源
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -

# 安装 Node.js
sudo dnf install -y nodejs

# 验证安装
node -v
npm -v
```

### 安装 Git 和构建工具
```bash
sudo dnf install -y git make gcc-c++
```

## 2. 部署项目

### 上传代码
您可以选择使用 Git 拉取代码，或者使用 SFTP 工具将本地代码上传到服务器（例如 `/var/www/crypto-app` 目录）。

### 安装依赖与构建
进入项目目录：
```bash
cd /path/to/your/project

# 安装依赖
npm install

# 构建前端
npm run build
```

## 3. 启动服务

我们将使用 PM2 来管理后台进程，确保应用在后台稳定运行。

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动应用 (运行在 3001 端口)
pm2 start npm --name "crypto-app" -- start

# 设置开机自启
pm2 startup
pm2 save
```

此时，您的应用已经在 `http://localhost:3001` 运行。

## 4. 配置 Nginx 反向代理 (推荐)

为了让用户通过域名或直接通过 IP (80端口) 访问，建议安装 Nginx。

### 安装 Nginx
```bash
sudo dnf install -y nginx

# 启动 Nginx 并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 配置转发
编辑配置文件：
```bash
sudo vi /etc/nginx/conf.d/crypto-app.conf
```

输入以下内容 (按 `i` 进入编辑模式，粘贴后按 `Esc` 然后输入 `:wq` 保存退出)：

```nginx
server {
    listen 80;
    server_name _;  # 如果有域名，请填入域名，例如 example.com

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 重载配置
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5. 防火墙设置 (阿里云控制台)

**重要**：请务必去阿里云控制台 -> 轻量应用服务器 -> 防火墙 (或安全组) 中放行以下端口：

- **80** (HTTP)
- **443** (HTTPS, 如果配置了 SSL)
- **3001** (如果您不使用 Nginx，直接访问端口)

---

## 常见问题

**Q: 为什么访问不了？**
A: 请检查阿里云控制台的防火墙是否开放了端口。

**Q: 数据库在哪里？**
A: 本项目使用 SQLite，数据文件会生成在项目根目录下的 `crypto_news.db`。请定期备份此文件。
