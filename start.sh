#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RULEBOOK_DIR="$ROOT_DIR/effortless-rulebook"
APP_DIR="$ROOT_DIR/app"

pick_free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

if ! command -v effortless >/dev/null 2>&1; then
  echo "Missing 'effortless' CLI. Install it first:"
  echo "  npm install -g @effortlessapi/cli"
  exit 1
fi

if [ ! -d "$RULEBOOK_DIR" ]; then
  echo "Missing rulebook directory: $RULEBOOK_DIR"
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Missing app directory: $APP_DIR"
  exit 1
fi

PORTS=()
while [ "${#PORTS[@]}" -lt 4 ]; do
  PORT="$(pick_free_port)"
  if ! printf '%s\n' "${PORTS[@]}" | grep -qx "$PORT" 2>/dev/null; then
    PORTS+=("$PORT")
  fi
done

APP_PORT="${PORTS[0]}"
EDITOR_API_PORT="${PORTS[1]}"
EDITOR_UI_PORT="${PORTS[2]}"
EDITOR_PG_PORT="${PORTS[3]}"

export RULEBOOK_EDITOR_API_PORT="$EDITOR_API_PORT"
export RULEBOOK_EDITOR_UI_PORT="$EDITOR_UI_PORT"
export RULEBOOK_EDITOR_PG_PORT="$EDITOR_PG_PORT"

echo "Using ports:"
printf '  app:       http://localhost:%s\n' "$APP_PORT"
printf '  editor UI: http://localhost:%s\n' "$EDITOR_UI_PORT"
printf '  editor API: http://localhost:%s\n' "$EDITOR_API_PORT"
printf '  postgres:  localhost:%s\n' "$EDITOR_PG_PORT"

echo "Starting Frilly rulebook editor..."
(cd "$RULEBOOK_DIR" && bash edit-rulebook.sh) &
RULEBOOK_PID=$!

echo "Starting Frilly app..."
(
  cd "$APP_DIR"
  if [ ! -d node_modules ]; then
    echo "Installing app dependencies..."
    npm install
  fi
  VITE_API_URL="http://localhost:$EDITOR_API_PORT" npm run dev -- --host 0.0.0.0 --port "$APP_PORT"
) &
APP_PID=$!

cleanup() {
  echo
  echo "Stopping Frilly services..."
  kill "$APP_PID" "$RULEBOOK_PID" 2>/dev/null || true
  wait "$APP_PID" "$RULEBOOK_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait "$APP_PID"
