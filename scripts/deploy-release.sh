#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
APP_NAME="${APP_NAME:-ai-grading-system}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
PREVIOUS_COMMIT="${PREVIOUS_COMMIT:-}"
TARGET_COMMIT="${TARGET_COMMIT:-$(git -C "$APP_DIR" rev-parse HEAD)}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
BACKUP_FILE=""
RELEASE_STARTED=0

log() {
  printf '\n[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

rollback_application() {
  local failed_status="$1"
  local failed_line="${2:-unknown}"
  local failed_command="${3:-unknown}"
  trap - ERR
  set +e

  echo "[deploy] failed: status=$failed_status line=$failed_line command=$failed_command" >&2
  echo "Deployment failed with status $failed_status. Starting application rollback."
  if [ -n "$PREVIOUS_COMMIT" ]; then
    git -C "$APP_DIR" reset --hard "$PREVIOUS_COMMIT"
    if [ "$RELEASE_STARTED" -eq 1 ]; then
      cd "$APP_DIR"
      if npm ci && npx prisma generate && npm run build && pm2 startOrRestart ecosystem.config.js --env production --update-env && pm2 save; then
        echo "Application rollback completed: $PREVIOUS_COMMIT"
      else
        echo "Application rollback was incomplete. The previous PM2 process may still be serving; inspect PM2 logs immediately." >&2
      fi
    else
      echo "Git working tree restored: $PREVIOUS_COMMIT"
    fi
    if [ -n "$BACKUP_FILE" ]; then
      echo "Database backup retained for manual recovery: $BACKUP_FILE"
    fi
  else
    echo "Rollback was not required because release mutation had not started."
  fi
  exit "$failed_status"
}

trap 'rollback_application "$?" "$LINENO" "$BASH_COMMAND"' ERR

cd "$APP_DIR"
test -f "$ENV_FILE"

# shellcheck source=scripts/lib/database-env.sh
source "$SCRIPT_DIR/lib/database-env.sh"
load_database_env "$ENV_FILE"

APP_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/ai_grading_hust_course}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000${APP_BASE_PATH}/api/health}"

for command_name in git node npm npx pm2 curl; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Required command missing: $command_name" >&2; exit 1; }
done

actual_commit=$(git -C "$APP_DIR" rev-parse HEAD)
if [ "$actual_commit" != "$TARGET_COMMIT" ]; then
  echo "[deploy] git check failed: expected $TARGET_COMMIT but HEAD is $actual_commit" >&2
  false
fi
if ! git -C "$APP_DIR" diff --quiet || ! git -C "$APP_DIR" diff --cached --quiet; then
  echo "[deploy] git check failed: tracked files contain uncommitted changes" >&2
  false
fi
echo "[deploy] git check passed: $actual_commit"

log "Preflight PostgreSQL client"
bash "$SCRIPT_DIR/ensure-postgres-client.sh"
psql "$PG_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 --command='SELECT 1;' >/dev/null

log "Pre-migration database backup"
BACKUP_FILE=$(APP_DIR="$APP_DIR" ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup-db.sh" | tail -n 1)
test -s "$BACKUP_FILE"

RELEASE_STARTED=1

log "Install locked dependencies"
npm ci

log "Generate Prisma Client"
npx prisma generate

log "Build Next.js application for $TARGET_COMMIT"
NEXT_DEPLOYMENT_ID="$TARGET_COMMIT" npm run build

log "Apply Prisma migrations"
npx prisma migrate deploy

log "Start or reload PM2"
pm2 startOrRestart ecosystem.config.js --env production --update-env
pm2 save

pm2_pid=$(pm2 pid "$APP_NAME")
if ! [[ "$pm2_pid" =~ ^[1-9][0-9]*$ ]]; then
  echo "[deploy] pm2 check failed: $APP_NAME has no online process (pid=${pm2_pid:-none})" >&2
  false
fi
echo "[deploy] pm2 check passed: $APP_NAME pid=$pm2_pid"

log "Health check: $HEALTHCHECK_URL"
health_status="000"
for attempt in 1 2 3 4 5 6; do
  if health_status=$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' "$HEALTHCHECK_URL"); then
    curl_status=0
  else
    curl_status=$?
  fi
  if [ "$health_status" = "200" ]; then
    echo "[deploy] health check passed: url=$HEALTHCHECK_URL status=$health_status attempt=$attempt"
    break
  fi
  echo "[deploy] health check attempt $attempt failed: url=$HEALTHCHECK_URL http_status=$health_status curl_status=$curl_status" >&2
  sleep 5
done
if [ "$health_status" != "200" ]; then
  echo "[deploy] health check failed after 6 attempts: url=$HEALTHCHECK_URL last_http_status=$health_status" >&2
  false
fi

trap - ERR
log "Deployment successful"
echo "Commit: $TARGET_COMMIT"
echo "Backup: $BACKUP_FILE"
