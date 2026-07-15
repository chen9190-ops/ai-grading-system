#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/ai-grading-system-backup.log}"

test -f "$ENV_FILE" || { echo "Environment file not found: $ENV_FILE" >&2; exit 1; }
bash "$SCRIPT_DIR/ensure-postgres-client.sh"

if ! command -v crontab >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ] && command -v apt-get >/dev/null 2>&1; then
    env DEBIAN_FRONTEND=noninteractive apt-get update
    env DEBIAN_FRONTEND=noninteractive apt-get install -y cron
  elif [ "$(id -u)" -eq 0 ] && command -v dnf >/dev/null 2>&1; then
    dnf install -y cronie
  elif [ "$(id -u)" -eq 0 ] && command -v yum >/dev/null 2>&1; then
    yum install -y cronie
  else
    echo "crontab is not installed and cannot be installed automatically" >&2
    exit 1
  fi
fi

cron_command="$CRON_SCHEDULE APP_DIR='$APP_DIR' ENV_FILE='$ENV_FILE' /usr/bin/env bash '$SCRIPT_DIR/backup-db.sh' >> '$LOG_FILE' 2>&1"
existing=$(crontab -l 2>/dev/null || true)
filtered=$(printf '%s\n' "$existing" | sed '/# BEGIN ai-grading-system backup/,/# END ai-grading-system backup/d')
{
  printf '%s\n' "$filtered"
  echo "# BEGIN ai-grading-system backup"
  echo "$cron_command"
  echo "# END ai-grading-system backup"
} | crontab -

echo "Cron backup installed: $CRON_SCHEDULE"
echo "Backup command: $SCRIPT_DIR/backup-db.sh"
