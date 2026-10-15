#!/usr/bin/env bash
# Tests de la base : crée une base Postgres jetable, applique les migrations,
# puis vérifie les règles d'accès et les automatismes.
# Besoin : PostgreSQL 15 ou plus installé sur la machine (initdb, pg_ctl, psql).
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || BIN="$(dirname "$(command -v initdb)")"
DOSSIER="$(mktemp -d)"
PORT="${PG_PORT:-54329}"

# Postgres refuse de tourner en « root » : on passe par l'utilisateur postgres si besoin.
lancer() {
  if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi
}
[ "$(id -u)" = 0 ] && chown postgres "$DOSSIER"

arreter() { lancer "$BIN/pg_ctl" -D "$DOSSIER/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DOSSIER"; }
trap arreter EXIT

lancer "$BIN/initdb" -D "$DOSSIER/data" -U postgres -A trust >/dev/null
lancer "$BIN/pg_ctl" -D "$DOSSIER/data" -o "-p $PORT -k $DOSSIER -c listen_addresses=''" -l "$DOSSIER/log" -w start >/dev/null

PSQL=(lancer "$BIN/psql" -h "$DOSSIER" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$ICI/socle.sql"
for f in "$RACINE"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
echo "Migrations appliquées : $(ls "$RACINE"/supabase/migrations/*.sql | wc -l)"
"${PSQL[@]}" -f "$ICI/tests.sql" 2>&1 | sed -E "s/^psql:[^ ]+ (NOTICE|ERROR):  //"
