#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-ai-grading-system}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> Pulling latest code"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f ".env.production" ]; then
  cp .env.production.example .env.production
  echo "Created .env.production from .env.production.example"
  echo "Please edit .env.production and set DIFY_API_KEY, then rerun update.sh"
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Building Next.js application"
npm run build

echo "==> Restarting PM2 application"
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env.production"
set +a
pm2 startOrRestart ecosystem.config.js --env production --update-env
pm2 save

echo "==> Update completed"
pm2 status "$APP_NAME"
