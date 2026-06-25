module.exports = {
  apps: [
    {
      name: "ai-grading-system",
      script: "npm",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        DIFY_API_KEY: process.env.DIFY_API_KEY,
        DIFY_BASE_URL: process.env.DIFY_BASE_URL || "https://api.dify.ai/v1",
      },
      error_file: "/var/log/pm2/ai-grading-system-error.log",
      out_file: "/var/log/pm2/ai-grading-system-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
