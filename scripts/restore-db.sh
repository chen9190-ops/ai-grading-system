#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: APP_DIR=/var/www/ai-grading-system bash scripts/restore-db.sh /path/to/backup.dump" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
BACKUP_FILE="$1"

test -f "$BACKUP_FILE" || { echo "Backup file not found: $BACKUP_FILE" >&2; exit 1; }

# shellcheck source=scripts/lib/database-env.sh
source "$SCRIPT_DIR/lib/database-env.sh"
load_database_env "$ENV_FILE"

echo "WARNING: this will replace objects in the configured production database."
if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "Set CONFIRM_RESTORE=YES to continue." >&2
  exit 1
fi

if command -v pg_restore >/dev/null 2>&1 && pg_restore --list "$BACKUP_FILE" >/dev/null 2>&1; then
  pg_restore \
    --dbname="$PG_DATABASE_URL" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --exit-on-error \
    "$BACKUP_FILE"
else
  command -v psql >/dev/null 2>&1 || { echo "psql is not installed" >&2; exit 1; }
  psql "$PG_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 --file="$BACKUP_FILE"
fi

echo "Database restored from $BACKUP_FILE"
