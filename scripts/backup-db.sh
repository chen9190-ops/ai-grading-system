#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ai-grading-system}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_KEEP_COUNT="${BACKUP_KEEP_COUNT:-30}"

# shellcheck source=scripts/lib/database-env.sh
source "$SCRIPT_DIR/lib/database-env.sh"
load_database_env "$ENV_FILE"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Run scripts/ensure-postgres-client.sh first." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp=$(date -u '+%Y%m%dT%H%M%SZ')
backup_file="$BACKUP_DIR/backup_${timestamp}.dump"
temporary_file="${backup_file}.tmp"

cleanup() {
  rm -f "$temporary_file"
}
trap cleanup EXIT

echo "Creating PostgreSQL backup: $backup_file"
pg_dump \
  --dbname="$PG_DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-acl \
  --file="$temporary_file"

test -s "$temporary_file"
pg_restore --list "$temporary_file" >/dev/null
mv "$temporary_file" "$backup_file"
chmod 600 "$backup_file"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'backup_*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -delete
mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'backup_*.dump' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
if [ "${#backups[@]}" -gt "$BACKUP_KEEP_COUNT" ]; then
  printf '%s\0' "${backups[@]:$BACKUP_KEEP_COUNT}" | xargs -0 -r rm -f
fi

trap - EXIT
echo "Backup successful: $backup_file"
printf '%s\n' "$backup_file"
