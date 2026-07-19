#!/usr/bin/env bash
# ============================================================
# Skillmate AI — PostgreSQL Backup Script
# ============================================================
# Creates a gzipped pg_dump and prunes backups older than 7 days.
#
# Environment variables (all have sane defaults):
#   POSTGRES_HOST     default: postgres
#   POSTGRES_DB       default: skillmate
#   POSTGRES_USER     default: skillmate
#   POSTGRES_PASSWORD default: (none — uses .pgpass or trust)
#
# Output:
#   /backups/skillmate_2026-07-19_02-00.sql.gz
#
# Usage:
#   ./scripts/backup.sh            # manual run
#   Called by crond inside the backup Docker service
# ============================================================

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

PG_HOST="${POSTGRES_HOST:-postgres}"
PG_DB="${POSTGRES_DB:-skillmate}"
PG_USER="${POSTGRES_USER:-skillmate}"

TIMESTAMP="$(date +%Y-%m-%d_%H-%M)"
FILENAME="${PG_DB}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

LOG_PREFIX="[backup]"

# ── Ensure backup directory exists ─────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Run pg_dump ────────────────────────────────────────────────
echo "${LOG_PREFIX} $(date -Iseconds) Starting backup → ${FILENAME}"

if PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
    --host="${PG_HOST}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${PG_USER}" \
    --dbname="${PG_DB}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    2>&1 | gzip > "${FILEPATH}"; then

    FILE_SIZE=$(du -h "${FILEPATH}" | cut -f1)
    echo "${LOG_PREFIX} $(date -Iseconds) ✅ Backup completed: ${FILENAME} (${FILE_SIZE})"
else
    echo "${LOG_PREFIX} $(date -Iseconds) ❌ Backup FAILED for ${PG_DB}" >&2
    rm -f "${FILEPATH}"   # clean up partial file
    exit 1
fi

# ── Validate — file must be > 1KB (non-empty dump) ────────────
FILE_BYTES=$(stat -c%s "${FILEPATH}" 2>/dev/null || stat -f%z "${FILEPATH}" 2>/dev/null || echo 0)

if [ "${FILE_BYTES}" -lt 1024 ]; then
    echo "${LOG_PREFIX} $(date -Iseconds) ⚠️  WARNING: Backup file is suspiciously small (${FILE_BYTES} bytes)" >&2
fi

# ── Prune old backups ─────────────────────────────────────────
echo "${LOG_PREFIX} $(date -Iseconds) Pruning backups older than ${RETENTION_DAYS} days..."

DELETED=$(find "${BACKUP_DIR}" -name "${PG_DB}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -print -delete | wc -l)

echo "${LOG_PREFIX} $(date -Iseconds) Pruned ${DELETED} old backup(s)"

# ── Summary ────────────────────────────────────────────────────
TOTAL=$(find "${BACKUP_DIR}" -name "${PG_DB}_*.sql.gz" -type f | wc -l)
echo "${LOG_PREFIX} $(date -Iseconds) Total backups on disk: ${TOTAL}"
echo "${LOG_PREFIX} $(date -Iseconds) Done."
