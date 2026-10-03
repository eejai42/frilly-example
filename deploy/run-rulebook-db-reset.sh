#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Which filename does the installed rulebook-to-postgres emit?
if [ -f "$SCRIPT_DIR/reset-rulebook-db.sh" ]; then
  DB_APPLY_SCRIPT="$SCRIPT_DIR/reset-rulebook-db.sh"
elif [ -f "$SCRIPT_DIR/init-db.sh" ]; then
  echo "[db-apply] reset-rulebook-db.sh not found; using legacy init-db.sh" >&2
  DB_APPLY_SCRIPT="$SCRIPT_DIR/init-db.sh"
else
  echo "[db-apply] no database apply script found; expected reset-rulebook-db.sh or legacy init-db.sh" >&2
  exit 127
fi

# ------------------------------------------------------------------------
# The first apply in this container's life is a build from scratch. Every
# apply after it must be additive.
#
# The Postgres cluster lives inside the container with no volume, so it is
# always empty at boot -- the first apply has nothing to preserve and the
# from-scratch build is free. Every rebuild after that runs while somebody
# has the editor open, with rows they added through the UI and edits not yet
# saved back to the rulebook. Those must survive: a rulebook change should
# add the new tables and columns, upsert the rulebook's own rows, and leave
# everything else exactly where it is.
#
# rulebook-to-postgres already generates that shape in its default
# mode=check-add (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
# CREATE OR REPLACE for the derived layer, ON CONFLICT DO UPDATE for rows),
# and the rulebooktopostgres step pins mode=check-add so this does not
# depend on a default that lives in another tool. The block below is the
# check that it actually held.
#
# On a violation this REFUSES the step. It does not fall back to applying
# some safer-looking subset: half-applied SQL against a live editor is a
# worse outcome than a build step that stops and says which file would have
# destroyed data.
# ------------------------------------------------------------------------
STAMP_FILE="${EFFORTLESS_EDITOR_DB_STAMP:-/tmp/rulebook-db-applied}"

if [ ! -f "$STAMP_FILE" ]; then
  echo "[db-apply] first apply for this container -- building the database from scratch"
elif [ "${EFFORTLESS_EDITOR_ALLOW_DB_RESET:-}" = "1" ]; then
  echo "[db-apply] EFFORTLESS_EDITOR_ALLOW_DB_RESET=1 -- destructive SQL allowed on this rebuild"
else
  OFFENDING_FILES=""
  shopt -s nullglob
  for sql_file in "$SCRIPT_DIR"/[0-9][0-9]*-*.sql; do
    # Comments come off first: 00-bootstrap.sql ships an inert, commented-out
    # drop-everything block that must not trip this.
    #
    # pipefail is off inside the subshell on purpose. grep -q exits at its
    # first match, sed then dies of SIGPIPE, and pipefail would report that
    # as "no match" -- turning the guard into a silent no-op.
    if ( set +o pipefail; sed 's/--.*$//' "$sql_file" \
         | grep -qiE '(DROP[[:space:]]+(TABLE|SCHEMA|DATABASE)|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM)' ); then
      OFFENDING_FILES="$OFFENDING_FILES $(basename "$sql_file")"
    fi
  done
  if [ -n "$OFFENDING_FILES" ]; then
    echo "[db-apply] REFUSING to apply: this rebuild would destroy data in a running editor." >&2
    echo "[db-apply]   offending file(s):$OFFENDING_FILES" >&2
    echo "[db-apply] While the container is up, a rebuild is additive only. The usual cause" >&2
    echo "[db-apply] is the rulebooktopostgres step in effortless.json having lost its" >&2
    echo "[db-apply] '-p mode=check-add' (mode=drop-all generates DROP TABLE), or a" >&2
    echo "[db-apply] hand-written NNb-customize-*.sql that drops or deletes." >&2
    echo "[db-apply] To wipe on purpose: restart the container -- the DB is built from" >&2
    echo "[db-apply] scratch on every boot -- or set EFFORTLESS_EDITOR_ALLOW_DB_RESET=1." >&2
    exit 1
  fi
  echo "[db-apply] rebuild while running -- applying additively (new tables/columns, upserted rows)"
fi

# Not exec'd: the stamp is only written once the apply has actually succeeded,
# so a build that dies before the SQL lands is still treated as the first one.
"$DB_APPLY_SCRIPT"
touch "$STAMP_FILE"
