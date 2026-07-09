#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: bash restore-db.sh backup.sql"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed"
  exit 1
fi

psql -d ai_grading_system < "$BACKUP_FILE"
echo "Database restored from $BACKUP_FILE"
