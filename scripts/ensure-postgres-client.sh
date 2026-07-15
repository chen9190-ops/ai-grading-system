#!/usr/bin/env bash
set -Eeuo pipefail

if command -v pg_dump >/dev/null 2>&1 && command -v psql >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1; then
  echo "PostgreSQL client available: $(pg_dump --version)"
  exit 0
fi

run_privileged() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n "$@"
  else
    echo "PostgreSQL client is missing and the deployment user cannot install packages." >&2
    echo "Install postgresql-client on the ECS host or grant passwordless sudo for package installation." >&2
    exit 1
  fi
}

if command -v apt-get >/dev/null 2>&1; then
  run_privileged env DEBIAN_FRONTEND=noninteractive apt-get update
  run_privileged env DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-client
elif command -v dnf >/dev/null 2>&1; then
  run_privileged dnf install -y postgresql
elif command -v yum >/dev/null 2>&1; then
  run_privileged yum install -y postgresql
else
  echo "Unsupported package manager. Install pg_dump, psql and pg_restore manually." >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1
command -v psql >/dev/null 2>&1
command -v pg_restore >/dev/null 2>&1
echo "PostgreSQL client installed: $(pg_dump --version)"
