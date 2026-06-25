# 阿里云 ECS 部署指南

本文档用于将当前 Next.js AI 智能批改系统部署到阿里云 ECS Ubuntu 22.04。

部署架构：

- Next.js App Router 使用 `npm run build` 构建
- 生产服务使用 `npm start`，即 `next start`
- PM2 管理 Node.js 进程
- Nginx 监听 80 端口并反向代理到 `127.0.0.1:3000`
- Dify API Key 只通过服务器环境变量读取

## 1. ECS 购买配置

推荐最低配置：

- 地域：选择离用户最近的地域，例如华东 1、华东 2、华北 2
- 实例规格：2 vCPU / 4 GB 内存起步
- 系统盘：40 GB ESSD 云盘起步
- 操作系统：Ubuntu 22.04 64 位
- 带宽：1 Mbps 起步，图片上传较多建议 3 Mbps 或更高
- 登录方式：推荐 SSH 密钥，也可以使用密码

如果并发较高，建议：

- 4 vCPU / 8 GB 内存
- 80 GB 系统盘
- 5 Mbps 或更高带宽

## 2. 安全组开放端口

在阿里云 ECS 控制台中进入实例安全组，添加入方向规则：

| 端口 | 协议 | 授权对象 | 用途 |
| --- | --- | --- | --- |
| 22 | TCP | 你的固定 IP，或临时 `0.0.0.0/0` | SSH 登录 |
| 80 | TCP | `0.0.0.0/0` | HTTP 访问 |
| 443 | TCP | `0.0.0.0/0` | HTTPS 访问，后续配置证书使用 |

不需要对公网开放 3000 端口。3000 只给 Nginx 在本机访问。

## 3. 上传项目

推荐方式是把代码推送到 Git 仓库，然后在 ECS 上使用部署脚本自动 `git clone`。

示例：

```bash
ssh root@你的服务器公网IP
```

在服务器上执行：

```bash
mkdir -p /opt/deploy
cd /opt/deploy
```

上传或创建本仓库中的 `deploy.sh`，然后执行首次部署。

如果你不使用 Git 仓库，也可以手动把项目上传到 `/var/www/ai-grading-system`，再在项目目录中执行 `npm install`、`npm run build`、`pm2 startOrRestart ecosystem.config.js --env production --update-env`。但推荐 Git 方式，后续更新更稳定。

## 4. 修改环境变量

部署脚本会在项目目录生成：

```bash
/var/www/ai-grading-system/.env.production
```

请编辑它：

```bash
cd /var/www/ai-grading-system
nano .env.production
```

内容示例：

```bash
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1

DIFY_BASE_URL=https://api.dify.ai/v1
DIFY_API_KEY=你的DifyServiceAPIKey
```

保存后执行：

```bash
bash update.sh
```

注意：

- 不要把真实 `DIFY_API_KEY` 提交到 Git 仓库
- 前端页面不会读取 Dify Key
- API Routes 会在服务端通过 `process.env.DIFY_API_KEY` 和 `process.env.DIFY_BASE_URL` 读取配置

## 5. 首次部署

在 ECS 上执行：

```bash
sudo REPO_URL=https://github.com/你的用户名/你的仓库.git bash deploy.sh
```

如果你的默认分支不是 `main`：

```bash
sudo REPO_URL=https://github.com/你的用户名/你的仓库.git BRANCH=master bash deploy.sh
```

如果你有域名：

```bash
sudo REPO_URL=https://github.com/你的用户名/你的仓库.git DOMAIN_NAME=example.com bash deploy.sh
```

部署完成后访问：

```text
http://你的服务器公网IP
```

或：

```text
http://你的域名
```

## 6. 更新项目

以后更新代码后，在服务器项目目录执行：

```bash
cd /var/www/ai-grading-system
bash update.sh
```

`update.sh` 会自动完成：

- `git pull`
- `npm install`
- `npm run build`
- PM2 重启应用

如果需要更新指定分支：

```bash
BRANCH=main bash update.sh
```

## 7. 查看日志

查看 PM2 实时日志：

```bash
pm2 logs ai-grading-system
```

查看最近 200 行日志：

```bash
pm2 logs ai-grading-system --lines 200
```

查看 Nginx 访问日志：

```bash
tail -f /var/log/nginx/ai-grading-system.access.log
```

查看 Nginx 错误日志：

```bash
tail -f /var/log/nginx/ai-grading-system.error.log
```

查看应用文件日志：

```bash
tail -f /var/log/pm2/ai-grading-system-out.log
tail -f /var/log/pm2/ai-grading-system-error.log
```

## 8. PM2 常用命令

查看进程：

```bash
pm2 status
```

重启应用：

```bash
pm2 restart ai-grading-system --update-env
```

停止应用：

```bash
pm2 stop ai-grading-system
```

删除应用：

```bash
pm2 delete ai-grading-system
```

保存当前进程列表：

```bash
pm2 save
```

设置开机自启：

```bash
pm2 startup systemd -u root --hp /root
pm2 save
```

## 9. Nginx 常用命令

测试配置：

```bash
nginx -t
```

重启 Nginx：

```bash
systemctl restart nginx
```

重新加载 Nginx：

```bash
systemctl reload nginx
```

查看 Nginx 状态：

```bash
systemctl status nginx
```

查看当前站点配置：

```bash
cat /etc/nginx/sites-available/ai-grading-system
```

## 10. 常见错误处理

### 10.1 访问 502 Bad Gateway

检查 PM2 进程是否运行：

```bash
pm2 status
pm2 logs ai-grading-system --lines 100
```

检查 3000 端口是否监听：

```bash
ss -lntp | grep 3000
```

如果没有监听，重新启动：

```bash
cd /var/www/ai-grading-system
bash update.sh
```

### 10.2 API 返回 Missing DIFY_API_KEY or DIFY_BASE_URL

说明 `.env.production` 没有正确配置或 PM2 没有加载最新环境变量。

修复：

```bash
cd /var/www/ai-grading-system
nano .env.production
set -a
source .env.production
set +a
pm2 restart ai-grading-system --update-env
pm2 save
```

### 10.3 图片上传失败或请求体过大

当前 Nginx 配置包含：

```nginx
client_max_body_size 30m;
```

如果上传更大的图片，请修改：

```bash
nano /etc/nginx/sites-available/ai-grading-system
nginx -t
systemctl reload nginx
```

### 10.4 SSE 流式进度不刷新

当前 Nginx 对 `/api/grade` 已关闭代理缓冲：

```nginx
proxy_buffering off;
proxy_cache off;
```

如果仍然不刷新，检查是否经过了其他 CDN 或网关。CDN 可能会缓冲 SSE 响应。

### 10.5 `npm run build` 内存不足

升级 ECS 内存，或临时增加 swap：

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

再次执行：

```bash
cd /var/www/ai-grading-system
npm run build
```

### 10.6 Nginx 配置测试失败

执行：

```bash
nginx -t
```

根据错误行号检查：

```bash
nano /etc/nginx/sites-available/ai-grading-system
```

修改后：

```bash
nginx -t
systemctl restart nginx
```

### 10.7 服务器重启后应用没有自动启动

执行：

```bash
pm2 startup systemd -u root --hp /root
pm2 save
systemctl enable nginx
```

然后重启 ECS 测试。

## 文件说明

本项目新增的部署文件：

- `ecosystem.config.js`：PM2 进程配置
- `nginx.ai-grading-system.conf`：Nginx 反向代理配置
- `deploy.sh`：首次部署脚本
- `update.sh`：更新脚本
- `.env.production.example`：生产环境变量示例
- `README_DEPLOY.md`：部署说明

这些文件不修改业务逻辑，不影响本地开发。
