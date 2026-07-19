#!/usr/bin/env bash
# ============================================================
# Skillmate AI — PostgreSQL Restore Script
# ============================================================
# Restores a gzipped pg_dump file to the target database.
#
# Usage:
#   ./scripts/restore.sh skillmate_2026-07-19_02-00.sql.gz
#   ./scripts/restore.sh /backups/skillmate_2026-07-19_02-00.sql.gz
#
# Environment variables:
#   POSTGRES_HOST     default: postgres
#   POSTGRES_DB       default: skillmate
#   POSTGRES_USER     default: skillmate
#   POSTGRES_PASSWORD default: (none)
#
# CAUTION: This will DROP and re-create all tables in the target
#          database. A confirmation prompt is shown before proceeding.
# ============================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PG_HOST="${POSTGRES_HOST:-postgres}"
PG_DB="${POSTGRES_DB:-skillmate}"
PG_USER="${POSTGRES_USER:-skillmate}"
PG_PORT="${POSTGRES_PORT:-5432}"

LOG_PREFIX="[restore]"

# ── Argument validation ────────────────────────────────────────
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_filename>"
    echo ""
    echo "Examples:"
    echo "  $0 skillmate_2026-07-19_02-00.sql.gz"
    echo "  $0 /backups/skillmate_2026-07-19_02-00.sql.gz"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/*.sql.gz 2>/dev/null || echo "  (none found in ${BACKUP_DIR})"
    exit 1
fi

INPUT_FILE="$1"

# Resolve path — accept both absolute paths and bare filenames
if [ -f "${INPUT_FILE}" ]; then
    FILEPATH="${INPUT_FILE}"
elif [ -f "${BACKUP_DIR}/${INPUT_FILE}" ]; then
    FILEPATH="${BACKUP_DIR}/${INPUT_FILE}"
else
    echo "${LOG_PREFIX} ❌ File not found: ${INPUT_FILE}" >&2
    echo "Searched:"
    echo "  - ${INPUT_FILE}"
    echo "  - ${BACKUP_DIR}/${INPUT_FILE}"
    exit 1
fi

FILE_SIZE=$(du -h "${FILEPATH}" | cut -f1)
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ⚠️  DATABASE RESTORE — DESTRUCTIVE ⚠️          ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                        ║"
printf "║  File:     %-42s  ║\n" "$(basename "${FILEPATH}")"
printf "║  Size:     %-42s  ║\n" "${FILE_SIZE}"
printf "║  Target:   %-42s  ║\n" "${PG_DB}@${PG_HOST}:${PG_PORT}"
printf "║  User:     %-42s  ║\n" "${PG_USER}"
echo "║                                                        ║"
echo "║  This will DROP all existing data in the target DB     ║"
echo "║  and replace it with the backup contents.              ║"
echo "║                                                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Confirmation prompt ────────────────────────────────────────
read -r -p "Type 'yes' to proceed with restore: " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "${LOG_PREFIX} Restore cancelled."
    exit 0
fi

echo ""
echo "${LOG_PREFIX} $(date -Iseconds) Starting restore from $(basename "${FILEPATH}")..."

# ── Drop and recreate database ─────────────────────────────────
# We connect to the default 'postgres' maintenance DB to issue DROP/CREATE
echo "${LOG_PREFIX} $(date -Iseconds) Dropping and recreating database '${PG_DB}'..."

PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
    --host="${PG_HOST}" \
    --port="${PG_PORT}" \
    --username="${PG_USER}" \
    --dbname="postgres" \
    --command="
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${PG_DB}' AND pid <> pg_backend_pid();
    " > /dev/null 2>&1 || true

PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
    --host="${PG_HOST}" \
    --port="${PG_PORT}" \
    --username="${PG_USER}" \
    --dbname="postgres" \
    --command="DROP DATABASE IF EXISTS \"${PG_DB}\";" \
    --command="CREATE DATABASE \"${PG_DB}\" OWNER \"${PG_USER}\";"

echo "${LOG_PREFIX} $(date -Iseconds) Database recreated."

# ── Restore from gzip dump ─────────────────────────────────────
echo "${LOG_PREFIX} $(date -Iseconds) Importing SQL..."

if gunzip -c "${FILEPATH}" | PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
    --host="${PG_HOST}" \
    --port="${PG_PORT}" \
    --username="${PG_USER}" \
    --dbname="${PG_DB}" \
    --single-transaction \
    --set ON_ERROR_STOP=1 \
    > /dev/null 2>&1; then

    echo "${LOG_PREFIX} $(date -Iseconds) ✅ Restore completed successfully."
else
    echo "${LOG_PREFIX} $(date -Iseconds) ❌ Restore FAILED." >&2
    exit 1
fi

# ── Verify ─────────────────────────────────────────────────────
TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
    --host="${PG_HOST}" \
    --port="${PG_PORT}" \
    --username="${PG_USER}" \
    --dbname="${PG_DB}" \
    --tuples-only \
    --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" \
    | tr -d ' ')

echo "${LOG_PREFIX} $(date -Iseconds) Verification: ${TABLE_COUNT} tables in '${PG_DB}'"
echo "${LOG_PREFIX} $(date -Iseconds) Done."
