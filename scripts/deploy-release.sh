#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
APP_NAME="${APP_NAME:-ai-grading-system}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
PREVIOUS_COMMIT="${PREVIOUS_COMMIT:-}"
TARGET_COMMIT="${TARGET_COMMIT:-$(git -C "$APP_DIR" rev-parse HEAD)}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}"
BACKUP_FILE=""
RELEASE_STARTED=0

log() {
  printf '\n[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

rollback_application() {
  local failed_status="$1"
  trap - ERR
  set +e

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

trap 'rollback_application $?' ERR

cd "$APP_DIR"
test -f "$ENV_FILE"

# shellcheck source=scripts/lib/database-env.sh
source "$SCRIPT_DIR/lib/database-env.sh"
load_database_env "$ENV_FILE"

for command_name in git node npm npx pm2 curl; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Required command missing: $command_name" >&2; exit 1; }
done

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

log "Health check"
health_status="000"
for attempt in 1 2 3 4 5 6; do
  health_status=$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' "$HEALTHCHECK_URL" || true)
  if [ "$health_status" = "200" ]; then
    break
  fi
  echo "Health check attempt $attempt returned $health_status"
  sleep 5
done
test "$health_status" = "200"

trap - ERR
log "Deployment successful"
echo "Commit: $TARGET_COMMIT"
echo "Backup: $BACKUP_FILE"
