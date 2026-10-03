#!/usr/bin/env bash
# Boot order: Postgres -> apply the generated SQL (rulebook -> DB) -> API -> app.
set -euo pipefail
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -1)"
mkdir -p /var/lib/postgresql/data && chown -R postgres:postgres /var/lib/postgresql
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
  su postgres -c "$PGBIN/initdb -D /var/lib/postgresql/data" > /tmp/initdb.log 2>&1
fi
su postgres -c "$PGBIN/pg_ctl -D /var/lib/postgresql/data -l /tmp/postgres.log -o '-h 127.0.0.1' start"
for _ in $(seq 1 30); do su postgres -c "psql -c 'select 1'" >/dev/null 2>&1 && break; sleep 1; done
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" >/dev/null
su postgres -c "createdb effortless-rulebook" >/dev/null 2>&1 || true
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=effortless-rulebook
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/effortless-rulebook"
export EFFORTLESS_EDITOR_DB_STAMP=/tmp/rulebook-db-applied
echo "[frilly] applying the generated SQL to Postgres…"
(cd /app/editor-src/postgres && ./run-rulebook-db-reset.sh) > /tmp/db-apply.log 2>&1 || { tail -40 /tmp/db-apply.log; exit 1; }
echo "[frilly] starting the rulebook API on :${API_PORT}"
(cd /app/editor-src/api && PORT="$API_PORT" EFFORTLESS_ROOT=/app/editor-src node index.js > /tmp/api.log 2>&1 &)
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1 && break; sleep 1; done
echo "[frilly] serving the app on :${PORT}"
cd /app/app && exec node server.mjs
