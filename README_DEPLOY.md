# 企业级自动部署说明

本项目已升级为基于 GitHub Actions + SSH + PM2 + PostgreSQL 的企业级部署方案，部署体系与业务逻辑保持独立。

## 1. GitHub Actions 自动部署

工作流文件位于 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)。

当代码推送到 main 分支时，GitHub Actions 会自动执行以下流程：

1. 通过 SSH 登录 ECS
2. 进入项目目录
3. 记录开始时间、提交哈希和分支名
4. 执行 git pull
5. 创建 PostgreSQL 备份
6. 执行 npm install
7. 执行 Prisma 生成和迁移
8. 执行 npm run build
9. 重启 PM2 进程
10. 执行健康检查
11. 失败时自动回滚

## 2. GitHub Secrets 配置

在 GitHub 仓库中进入 Settings → Secrets and variables → Actions，新增以下 Secrets：

- ECS_HOST：ECS 公网 IP 或可访问域名
- ECS_USER：SSH 登录用户名，例如 root
- ECS_SSH_KEY：SSH 私钥内容
- PROJECT_DIR：ECS 上项目目录，例如 /var/www/ai-grading-system

## 3. PostgreSQL 自动备份

部署前会自动执行备份：

```bash
mkdir -p /var/backups/ai-grading-system
pg_dump ai_grading_system > /var/backups/ai-grading-system/backup_YYYYMMDD_HHMMSS.sql
```

备份文件会保留最近 30 个，旧备份会被清理。

## 4. 自动回滚

如果以下任一阶段失败，工作流会自动触发回滚：

- git pull
- npm install
- Prisma 生成/迁移
- 构建
- PM2 重启
- 健康检查

回滚会执行：

```bash
git reset --hard <current_commit>
npm install
npm run build
pm2 restart ai-grading-system
pm2 save
```

## 5. 数据库恢复

恢复数据库使用脚本：

```bash
bash scripts/restore-db.sh backup.sql
```

## 6. 每日自动备份

安装每日凌晨 03:00 备份任务：

```bash
bash scripts/install-backup-cron.sh
```

该任务会每晚执行 PostgreSQL 备份，并删除 30 天前的备份文件。

## 7. 如何查看部署日志

在 GitHub Actions 页面查看工作流日志，或在服务器上查看：

```bash
pm2 logs ai-grading-system
```

## 8. 如何重新运行 Workflow

进入 GitHub 仓库的 Actions 页面，选择对应工作流后点击 Re-run jobs。

## 9. 如何恢复上一版本

如果需要回退到上一个提交：

```bash
cd /var/www/ai-grading-system
git log --oneline -n 5
git reset --hard <commit-hash>
npm install
npm run build
pm2 restart ai-grading-system
pm2 save
```

## 10. 服务器检查

执行检查脚本：

```bash
bash scripts/check-server.sh
```

脚本会检查 Node、NPM、PM2、Nginx、PostgreSQL、Prisma、Next.js、数据库连接、端口 3000 和端口 80。

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

## 10. Nginx 常用命令

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

## 11. 常见错误处理

### 11.1 访问 502 Bad Gateway

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

### 11.2 API 返回 Missing DIFY_API_KEY or DIFY_BASE_URL

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

### 11.3 图片上传失败或请求体过大

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

### 11.4 SSE 流式进度不刷新

当前 Nginx 对 `/api/grade` 已关闭代理缓冲：

```nginx
proxy_buffering off;
proxy_cache off;
```

如果仍然不刷新，检查是否经过了其他 CDN 或网关。CDN 可能会缓冲 SSE 响应。

### 11.5 `npm run build` 内存不足

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

### 11.6 Nginx 配置测试失败

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

### 11.7 服务器重启后应用没有自动启动

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
- `.github/workflows/deploy.yml`：push 到 `main` 时自动部署到 ECS
- `.env.production.example`：生产环境变量示例
- `README_DEPLOY.md`：部署说明

这些文件不修改业务逻辑，不影响本地开发。
