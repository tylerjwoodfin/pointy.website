#!/bin/bash
# Point production at origin/main and restart the WebSocket server when it changes.
# Pages deploys the website on every merge. This host does not, so a timer runs
# this script. Production is a separate checkout: a feature branch in the dev
# repo is never what the live server executes.
set -euo pipefail

LIVE="${POINTY_LIVE_DIR:-${HOME}/git/pointy.website-live}"
BIN="${HOME}/.local/bin/pointy-publish-live"
LOCK="${XDG_RUNTIME_DIR:-/tmp}/pointy-publish-live.lock"

mkdir -p "$(dirname "$LOCK")"
exec 9>"$LOCK"
if ! flock -n 9; then
  exit 0
fi

if [[ ! -e "$LIVE/.git" ]]; then
  echo "missing live checkout: $LIVE" >&2
  exit 1
fi

git -C "$LIVE" fetch origin main
old="$(git -C "$LIVE" rev-parse HEAD)"
new="$(git -C "$LIVE" rev-parse origin/main)"
if [[ "$old" == "$new" ]]; then
  exit 0
fi

needs_restart=0
needs_install=0
if ! git -C "$LIVE" diff --quiet "$old" "$new" -- server; then
  needs_restart=1
fi
if ! git -C "$LIVE" diff --quiet "$old" "$new" -- package.json package-lock.json; then
  needs_install=1
  needs_restart=1
fi

git -C "$LIVE" checkout --detach "$new"

if [[ "$needs_install" == 1 ]]; then
  npm ci --omit=dev --prefix "$LIVE"
fi

if [[ -f "$LIVE/server/publish-live.sh" ]]; then
  mkdir -p "$(dirname "$BIN")"
  install -m 755 "$LIVE/server/publish-live.sh" "$BIN"
fi

if [[ "$needs_restart" == 1 ]]; then
  sudo systemctl restart pointing-blackjack
fi
