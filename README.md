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

## 长时间批改请求

复杂题目的 Dify Workflow 可能运行 3～6 分钟。应用默认等待 360 秒，可通过环境变量调整：

```bash
DIFY_GRADING_TIMEOUT_MS=360000
```

如果经过 Nginx、PM2 或阿里云负载均衡代理，还需要确认代理没有使用更短的请求超时。Nginx 可参考以下配置；请先确认实际站点配置文件和部署拓扑，不要直接覆盖服务器配置：

```nginx
proxy_connect_timeout 60s;
proxy_send_timeout 360s;
proxy_read_timeout 360s;
```

生产排查时同时检查：

- `nginx -T` 中实际生效的 `proxy_connect_timeout`、`proxy_send_timeout`、`proxy_read_timeout`
- PM2 启动参数、进程环境变量及 Node/Next.js 外层请求超时
- 阿里云负载均衡实例的连接空闲超时
- Dify 网关、worker 和 plugin daemon 自身的任务超时

应用执行超时不会自动重新提交整个 Workflow，避免重复任务和重复计费；只有明确的连接错误或 HTTP 502、503、504 才会有限重试。

## 批改结果追问 Chatflow

批改后的 AI 助手使用独立的 Dify Chatflow，不会再次调用完整批改 Workflow。生产环境需要配置：

```bash
DIFY_FOLLOWUP_API_URL=https://api.dify.ai/v1/chat-messages
DIFY_FOLLOWUP_API_KEY=app-xxxxxxxx
```

对应 Chatflow 应声明这些 inputs：`question_text`、`student_answer`、`grading_report`、`score`、`subject`、`error_analysis`、`scoring_advice`、`conversation_history`、`system_instruction`。学生当前追问通过 Dify 的 `query` 字段传入。
