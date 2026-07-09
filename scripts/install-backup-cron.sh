#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/ai-grading-system"
CRON_JOB='0 3 * * * /usr/bin/env bash -lc "mkdir -p /var/backups/ai-grading-system && backup_file=\"/var/backups/ai-grading-system/backup_$(date +\'%Y%m%d_%H%M%S\').sql\" && pg_dump ai_grading_system > \"$backup_file\" && find /var/backups/ai-grading-system -maxdepth 1 -type f -name '\''backup_*.sql'\'' -mtime +30 -delete"'

if ! command -v cron >/dev/null 2>&1; then
  echo "Installing cron..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y cron
  else
    echo "cron is not available on this system." >&2
    exit 1
  fi
fi

mkdir -p "$BACKUP_DIR"

if ! crontab -l 2>/dev/null | grep -Fq "ai-grading-system backup"; then
  (
    crontab -l 2>/dev/null || true
    echo "# ai-grading-system backup"
    echo "$CRON_JOB"
  ) | crontab -
fi

echo "Cron backup installed successfully"
echo "Backup directory: $BACKUP_DIR"
echo "Schedule: 03:00 every day"
