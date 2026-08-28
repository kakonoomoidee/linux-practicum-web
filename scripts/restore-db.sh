#!/bin/bash
# ==============================================================================
# Restore PostgreSQL dari file backup yang dibuat scripts/backup-db.sh.
#
# CARA PAKAI:
#   ./scripts/restore-db.sh backups/praktikum_db_2026-01-15_020000.sql.gz
#
# PERINGATAN: ini akan MENIMPA seluruh data yang ada di database saat ini
# (backup dibuat dengan --clean --if-exists, jadi restore akan drop dan bikin
# ulang semua tabel). Pastikan ini benar-benar yang kamu mau sebelum lanjut.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/restore-db.sh <path-ke-file-backup.sql.gz>" >&2
  echo "" >&2
  echo "Backup yang tersedia:" >&2
  find "$PROJECT_ROOT/backups" -name "praktikum_db_*.sql.gz" 2>/dev/null | sort -r || echo "  (folder backups/ belum ada atau kosong)" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-db] ERROR: File tidak ditemukan: $BACKUP_FILE" >&2
  exit 1
fi

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

PGUSER="${PGUSER:-praktikum_user}"
PGDATABASE="${PGDATABASE:-praktikum_db}"

echo "[restore-db] PERINGATAN: ini akan menimpa seluruh data di database \"$PGDATABASE\"."
read -r -p "Ketik 'restore' untuk melanjutkan: " CONFIRMATION
if [ "$CONFIRMATION" != "restore" ]; then
  echo "[restore-db] Dibatalkan."
  exit 0
fi

echo "[restore-db] Merestore dari $BACKUP_FILE ..."

if command -v docker >/dev/null 2>&1 && docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps db 2>/dev/null | grep -q "Up\|running"; then
  echo "[restore-db] Terdeteksi Docker Compose - restore lewat 'docker compose exec db psql'"
  gunzip -c "$BACKUP_FILE" | docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T db psql -U "$PGUSER" -d "$PGDATABASE"
else
  echo "[restore-db] Tidak terdeteksi Docker Compose aktif - restore langsung lewat psql ke host"
  if ! command -v psql >/dev/null 2>&1; then
    echo "[restore-db] ERROR: psql tidak ditemukan. Install PostgreSQL client (postgresql-client) dulu." >&2
    exit 1
  fi
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE"
fi

echo "[restore-db] Restore selesai."
