#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"
test -f .env.production || { echo "Missing $APP_DIR/.env.production" >&2; exit 1; }

PREVIOUS_COMMIT=$(git rev-parse HEAD)
git fetch --prune origin "$BRANCH"
TARGET_COMMIT=$(git rev-parse "origin/$BRANCH")
git reset --hard "$TARGET_COMMIT"

APP_DIR="$APP_DIR" \
PREVIOUS_COMMIT="$PREVIOUS_COMMIT" \
TARGET_COMMIT="$TARGET_COMMIT" \
  bash scripts/deploy-release.sh
