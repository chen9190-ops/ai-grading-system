#!/usr/bin/env bash
set -u

TARGET_HOST="dashscope.aliyuncs.com"
TARGET_URL="https://${TARGET_HOST}"

echo "[dashscope-check] DNS resolution"
if command -v getent >/dev/null 2>&1; then
  getent hosts "$TARGET_HOST" || echo "DNS resolution failed"
elif command -v nslookup >/dev/null 2>&1; then
  nslookup "$TARGET_HOST" || echo "DNS resolution failed"
else
  echo "Neither getent nor nslookup is installed"
fi

echo "[dashscope-check] HTTPS 443 and curl timing"
curl -I --connect-timeout 10 --max-time 20 \
  --write-out $'\nconnect=%{time_connect}s tls=%{time_appconnect}s total=%{time_total}s http=%{http_code}\n' \
  "$TARGET_URL" || echo "HTTPS connectivity check failed"

echo "[dashscope-check] Proxy variables (values redacted)"
env | grep -iE '^(http|https|all|no)_proxy=' | sed 's/=.*$/=[configured]/' || echo "No proxy variables configured"

echo "[dashscope-check] If Dify runs in Docker, execute this script or the same DNS/curl checks inside the Dify worker and plugin daemon containers."
