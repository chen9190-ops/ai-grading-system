#!/usr/bin/env bash

load_database_env() {
  local env_file="${1:-${ENV_FILE:-.env.production}}"

  if [ ! -f "$env_file" ]; then
    echo "Environment file not found: $env_file" >&2
    return 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  if [ -z "${DATABASE_URL:-}" ]; then
    local missing=()
    local variable
    for variable in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
      if [ -z "${!variable:-}" ]; then
        missing+=("$variable")
      fi
    done

    if [ "${#missing[@]}" -gt 0 ]; then
      echo "DATABASE_URL is not set and these DB_* variables are missing: ${missing[*]}" >&2
      return 1
    fi

    DATABASE_URL=$(node -e '
      const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
      const url = new URL("postgresql://localhost");
      url.hostname = DB_HOST;
      url.port = DB_PORT;
      url.username = DB_USER;
      url.password = DB_PASSWORD;
      url.pathname = `/${DB_NAME}`;
      url.searchParams.set("schema", process.env.DB_SCHEMA || "public");
      process.stdout.write(url.toString());
    ')
    export DATABASE_URL
  fi

  PG_DATABASE_URL=$(DATABASE_URL="$DATABASE_URL" node -e '
    const url = new URL(process.env.DATABASE_URL);
    for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer"]) {
      url.searchParams.delete(key);
    }
    process.stdout.write(url.toString());
  ')
  export PG_DATABASE_URL
}
