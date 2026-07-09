#!/usr/bin/env bash
set -euo pipefail

check_command() {
  local name="$1"
  local cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name"
  fi
}

check_port() {
  local port="$1"
  local name="$2"
  if (command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$port") || \
     (command -v netstat >/dev/null 2>&1 && netstat -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$port"); then
    echo "PASS $name"
  else
    echo "FAIL $name"
  fi
}

check_command "Node.js" "node"
check_command "npm" "npm"
check_command "PM2" "pm2"
check_command "Nginx" "nginx"
check_command "PostgreSQL client" "pg_dump"
check_command "Prisma" "npx"

if [ -f ".env.production" ]; then
  echo "PASS Environment File"
else
  echo "FAIL Environment File"
fi

if command -v psql >/dev/null 2>&1; then
  if [ -n "${DATABASE_URL:-}" ]; then
    if psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
      echo "PASS Database Connection"
    else
      echo "FAIL Database Connection"
    fi
  else
    if psql -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
      echo "PASS Database Connection"
    else
      echo "FAIL Database Connection"
    fi
  fi
else
  echo "FAIL Database Connection"
fi

check_port "3000" "Port 3000"
check_port "80" "Port 80"
