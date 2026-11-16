#!/usr/bin/env bash
# Restore a backup set made by scripts/backup.sh. DESTRUCTIVE: replaces database objects and storage files.
# Usage: scripts/restore.sh <backup-dir> <timestamp> --yes
set -euo pipefail
cd "$(dirname "$0")/.."
# Values already in the environment win over .env.
if [ -f .env ]; then _keep="$(export -p)"; set -a; . ./.env; set +a; eval "$_keep"; fi
: "${DATABASE_URL:?DATABASE_URL belum diset}"
DIR="${1:?backup dir}"; TS="${2:?timestamp, mis. 20261116T120000Z}"
[ "${3:-}" = "--yes" ] || { echo "Tambahkan --yes untuk konfirmasi (operasi ini menimpa data)."; exit 1; }
( cd "$DIR" && sha256sum -c "dentweb-$TS.sha256" )
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DIR/dentweb-db-$TS.dump"
echo "Database dipulihkan."
if [ -f "$DIR/dentweb-storage-$TS.tar.gz" ]; then
  DEST="${STORAGE_DIR:-./.data/storage}"
  mkdir -p "$DEST"
  tar -xzf "$DIR/dentweb-storage-$TS.tar.gz" -C "$DEST"
  echo "Storage dipulihkan ke $DEST."
fi
echo "Selesai. Jalankan migrasi (pnpm db:migrate) bila backup berasal dari versi lebih lama."
