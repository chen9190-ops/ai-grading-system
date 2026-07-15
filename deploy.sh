#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-ai-grading-system}"
APP_DIR="${APP_DIR:-/var/www/ai-grading-system}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
DOMAIN_NAME="${DOMAIN_NAME:-_}"
NODE_MAJOR="${NODE_MAJOR:-20}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_NAME}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this script as root: sudo bash deploy.sh"
  exit 1
fi

if [ -z "$REPO_URL" ]; then
  echo "REPO_URL is required."
  echo "Example: sudo REPO_URL=https://github.com/yourname/ai-grading-system.git bash deploy.sh"
  exit 1
fi

echo "==> Updating apt packages"
apt update

echo "==> Installing base packages"
apt install -y ca-certificates curl gnupg git nginx postgresql-client

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v${NODE_MAJOR}."; then
  echo "==> Installing Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt install -y nodejs
fi

echo "==> Node version: $(node -v)"
echo "==> npm version: $(npm -v)"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2"
  npm install -g pm2
fi

echo "==> Preparing application directory"
mkdir -p "$(dirname "$APP_DIR")"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

cd "$APP_DIR"

if [ ! -f ".env.production" ]; then
  cp .env.production.example .env.production
  echo "==> Created .env.production from .env.production.example"
  chmod 600 .env.production
  echo "==> Edit $APP_DIR/.env.production, then rerun deploy.sh."
  exit 1
fi

mkdir -p /var/log/pm2
PREVIOUS_COMMIT=$(git rev-parse HEAD)
TARGET_COMMIT="$PREVIOUS_COMMIT"
APP_DIR="$APP_DIR" PREVIOUS_COMMIT="$PREVIOUS_COMMIT" TARGET_COMMIT="$TARGET_COMMIT" bash scripts/deploy-release.sh
pm2 startup systemd -u root --hp /root >/tmp/pm2-startup-command.txt

echo "==> Configuring Nginx"
cp "$APP_DIR/nginx.ai-grading-system.conf" "$NGINX_AVAILABLE"
sed -i "s/server_name _;/server_name ${DOMAIN_NAME};/" "$NGINX_AVAILABLE"
ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Deployment completed"
echo "App directory: $APP_DIR"
echo "Nginx server_name: $DOMAIN_NAME"
echo "PM2 app: $APP_NAME"
echo "If this is the first deployment, edit .env.production and run: bash update.sh"
