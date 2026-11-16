#!/usr/bin/env bash
# Backup: Postgres (pg_dump custom format) + local object storage (when STORAGE_DRIVER=local).
# Usage: scripts/backup.sh [output-dir]   (reads DATABASE_URL, STORAGE_DRIVER, STORAGE_DIR from env or .env)
# S3 storage is not copied here: enable bucket versioning / replication at the provider instead.
set -euo pipefail
cd "$(dirname "$0")/.."
# Values already in the environment win over .env.
if [ -f .env ]; then _keep="$(export -p)"; set -a; . ./.env; set +a; eval "$_keep"; fi
: "${DATABASE_URL:?DATABASE_URL belum diset}"
OUT="${1:-backups}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT"
umask 077
DB_FILE="$OUT/dentweb-db-$TS.dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$DB_FILE"
echo "DB      → $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
if [ "${STORAGE_DRIVER:-local}" = "local" ]; then
  DIR="${STORAGE_DIR:-./.data/storage}"
  if [ -d "$DIR" ]; then
    ST_FILE="$OUT/dentweb-storage-$TS.tar.gz"
    tar --exclude='_scratch' -czf "$ST_FILE" -C "$DIR" .
    echo "Storage → $ST_FILE ($(du -h "$ST_FILE" | cut -f1))"
  fi
fi
( cd "$OUT" && sha256sum dentweb-*-"$TS".* > "dentweb-$TS.sha256" )
echo "Checksum → $OUT/dentweb-$TS.sha256"
# Retention: keep the newest ${BACKUP_KEEP:-14} sets.
ls -1t "$OUT"/dentweb-*.sha256 2>/dev/null | tail -n +"$(( ${BACKUP_KEEP:-14} + 1 ))" | while read -r f; do
  t="$(basename "$f" .sha256 | sed 's/^dentweb-//')"; rm -f "$OUT"/dentweb-*-"$t".* "$f"
done
