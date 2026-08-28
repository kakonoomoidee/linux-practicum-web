#!/bin/bash
# ==============================================================================
# Backup PostgreSQL untuk Platform Praktikum Linux.
#
# CARA PAKAI MANUAL:
#   ./scripts/backup-db.sh
#
# CARA PAKAI OTOMATIS (dijadwalkan lewat cron di HOST, bukan di dalam container):
#   crontab -e
#   # Backup tiap hari jam 2 pagi:
#   0 2 * * * cd /path/ke/linux-praktikum && ./scripts/backup-db.sh >> logs/backup.log 2>&1
#
# Script ini otomatis mendeteksi apakah dijalankan di lingkungan Docker Compose
# (backup lewat "docker compose exec db pg_dump") atau lingkungan manual
# (backup langsung lewat "pg_dump" ke DATABASE_URL/PG* di .env).
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/praktikum_db_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Baca konfigurasi dari .env kalau ada (biar konsisten dengan yang dipakai app)
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

PGUSER="${PGUSER:-praktikum_user}"
PGDATABASE="${PGDATABASE:-praktikum_db}"

echo "[backup-db] Memulai backup database \"$PGDATABASE\" ke $BACKUP_FILE ..."

# Deteksi otomatis: apakah proyek ini dijalankan via Docker Compose (ada container
# "db" yang aktif)? Kalau iya, backup lewat docker compose exec supaya ga perlu
# install client PostgreSQL terpisah di host. Kalau bukan, asumsikan pg_dump
# tersedia langsung di host (setup manual tanpa Docker).
if command -v docker >/dev/null 2>&1 && docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps db 2>/dev/null | grep -q "Up\|running"; then
  echo "[backup-db] Terdeteksi Docker Compose - backup lewat 'docker compose exec db pg_dump'"
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" exec -T db \
    pg_dump -U "$PGUSER" -d "$PGDATABASE" --clean --if-exists | gzip > "$BACKUP_FILE"
else
  echo "[backup-db] Tidak terdeteksi Docker Compose aktif - backup langsung lewat pg_dump ke host"
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "[backup-db] ERROR: pg_dump tidak ditemukan. Install PostgreSQL client (postgresql-client) dulu." >&2
    exit 1
  fi
  PGPASSWORD="${PGPASSWORD:-}" pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" \
    --clean --if-exists | gzip > "$BACKUP_FILE"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup-db] Backup selesai: $BACKUP_FILE ($BACKUP_SIZE)"

# Rotasi - hapus backup yang lebih tua dari RETENTION_DAYS, biar folder backup
# ga numpuk tanpa batas. Default 14 hari, bisa diubah lewat env BACKUP_RETENTION_DAYS.
echo "[backup-db] Menghapus backup yang lebih tua dari $RETENTION_DAYS hari..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "praktikum_db_*.sql.gz" -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
echo "[backup-db] $DELETED_COUNT backup lama dihapus."

echo "[backup-db] Selesai. Total backup tersimpan sekarang: $(find "$BACKUP_DIR" -name "praktikum_db_*.sql.gz" | wc -l)"
