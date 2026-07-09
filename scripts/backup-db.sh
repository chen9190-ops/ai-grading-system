#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/ai-grading-system"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date '+%Y%m%d_%H%M%S').sql"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found"
  exit 1
fi

pg_dump ai_grading_system > "$BACKUP_FILE"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'backup_*.sql' | sort | head -n -30 | xargs -r rm -f
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'backup_*.sql' -mtime +30 -delete

echo "Backup Success"
echo "Backup File: $BACKUP_FILE"
