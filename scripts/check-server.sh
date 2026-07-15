#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
failed=0

check_command() {
  local name="$1"
  local command_name="$2"
  if command -v "$command_name" >/dev/null 2>&1; then
    echo "PASS $name: $($command_name --version 2>/dev/null | head -n 1 || true)"
  else
    echo "FAIL $name"
    failed=1
  fi
}

check_command "Node.js" node
check_command "npm" npm
check_command "PM2" pm2
check_command "Nginx" nginx
check_command "pg_dump" pg_dump
check_command "psql" psql
check_command "pg_restore" pg_restore

if [ -f "$ENV_FILE" ]; then
  echo "PASS Environment file"
  # shellcheck source=scripts/lib/database-env.sh
  source "$SCRIPT_DIR/lib/database-env.sh"
  if load_database_env "$ENV_FILE" && psql "$PG_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 --command='SELECT 1;' >/dev/null 2>&1; then
    echo "PASS Database connection"
  else
    echo "FAIL Database connection"
    failed=1
  fi
else
  echo "FAIL Environment file: $ENV_FILE"
  failed=1
fi

if curl --silent --show-error --fail --max-time 10 http://127.0.0.1:3000/api/health >/dev/null; then
  echo "PASS Application health"
else
  echo "FAIL Application health"
  failed=1
fi

if nginx -t >/dev/null 2>&1; then
  echo "PASS Nginx configuration"
else
  echo "FAIL Nginx configuration"
  failed=1
fi

exit "$failed"
