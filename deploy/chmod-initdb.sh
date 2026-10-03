#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$SCRIPT_DIR/run-rulebook-db-reset.sh"
[ ! -f "$SCRIPT_DIR/reset-rulebook-db.sh" ] || chmod +x "$SCRIPT_DIR/reset-rulebook-db.sh"
[ ! -f "$SCRIPT_DIR/init-db.sh" ] || chmod +x "$SCRIPT_DIR/init-db.sh"
