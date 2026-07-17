# 高校工程课程 AI 智能批改与学习平台

面向高校学生、教师与管理员的课程演示系统，包含图片批改、AI 力学助手、训练中心、教学分析和平台管理功能。

## 本地运行

复制 `.env.example` 为 `.env.local`，配置 PostgreSQL、认证密钥和 Dify 服务后执行：

```bash
npm install
npx prisma generate
npm run dev
```

默认访问地址为 [http://localhost:3000](http://localhost:3000)。生产环境可通过 `NEXT_PUBLIC_BASE_PATH` 配置子路径部署。

## 演示账号

| 角色 | 登录邮箱 | 密码来源 |
| --- | --- | --- |
| 学生 | `student@demo.edu.cn` | `SEED_STUDENT_PASSWORD` |
| 教师 | `teacher@demo.edu.cn` | `SEED_TEACHER_PASSWORD` |
| 管理员 | `admin@demo.edu.cn` | `SEED_ADMIN_PASSWORD` |

演示密码不会写入仓库。执行 seed 前，请在环境变量中设置以上三个密码变量：

```bash
npx prisma db seed
```

Seed 可重复执行，会生成高校教学演示所需的学生、教师、课程、批改记录、AI 对话、试卷与教学报告。

## 质量检查

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## DashScope 生产网络诊断

Dify 报告 `PluginInvokeError`、`HTTPSConnectionPool` 或连接 `dashscope.aliyuncs.com` 超时时，先在应用宿主机执行：

```bash
bash scripts/check-dashscope-connectivity.sh
```

代码只能识别错误、有限重试并向用户返回可操作的提示，不能修复服务器或容器的出网问题。如果宿主机可以访问 DashScope，但 Dify 无法访问，请在 Dify worker 和 plugin daemon 容器内执行同样的 DNS 与 HTTPS 检查，并排查：

- Docker DNS 配置
- 容器代理及代理变量是否正确传入
- 容器出网路由
- 阿里云安全组出站 443 规则
- 宿主机和容器防火墙
