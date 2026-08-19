#!/usr/bin/env python3
"""
Skillmate AI — Migrate Local Uploads to S3/R2
===============================================
One-shot migration script: reads every file from /app/uploads (or any
local upload directory) and pushes it to the configured S3/R2 bucket.
Also updates Resume.file_url in the database so existing records point
to their new cloud location.

Usage:
    # From inside the backend container:
    docker compose exec backend python scripts/migrate_uploads_to_s3.py

    # Dry-run (no actual uploads, no DB changes):
    docker compose exec backend python scripts/migrate_uploads_to_s3.py --dry-run

    # Specific source directory:
    docker compose exec backend python scripts/migrate_uploads_to_s3.py --src /tmp/uploads

Options:
    --src       Source directory to scan (default: settings.upload_dir)
    --dry-run   Print what would happen without uploading or updating DB
    --force     Re-upload files that already have an S3 URL in the DB

Prerequisites:
    S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (+ AWS_ENDPOINT_URL
    for R2) must be set in .env before running this script.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

# ── Bootstrap: add backend/ to sys.path so we can import app modules ──────
SCRIPT_DIR = Path(__file__).resolve().parent          # scripts/
BACKEND_DIR = SCRIPT_DIR.parent                       # backend/
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings                  # noqa: E402
from app.core.database import SessionLocal            # noqa: E402
from app.models.resume import Resume                  # noqa: E402
from app.services.storage_service import storage_service  # noqa: E402

# ── Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("migrate_uploads")


# ── Helpers ────────────────────────────────────────────────────────────────

def _discover_files(src_dir: Path) -> list[Path]:
    """Walk src_dir and return every file matching allowed extensions."""
    allowed = {ext.lower() for ext in settings.allowed_upload_extensions}
    found = []
    for root, _, files in os.walk(src_dir):
        for name in files:
            if Path(name).suffix.lower() in allowed:
                found.append(Path(root) / name)
    return sorted(found)


def _find_resume_by_path(db, local_path: str) -> Resume | None:
    """Look up a Resume row whose file_url matches the local path."""
    return (
        db.query(Resume)
        .filter(Resume.file_url == local_path)
        .first()
    )


async def _migrate_file(
    file_path: Path,
    db,
    dry_run: bool,
    force: bool,
    stats: dict,
) -> None:
    """Upload one file to S3 and update its DB record."""
    local_str = str(file_path)

    # ── Resolve owner from DB (best-effort) ───────────────────────────────
    resume = _find_resume_by_path(db, local_str)
    user_id = resume.user_id if resume else "migration"

    # ── Skip if already on S3 and not forcing ─────────────────────────────
    if resume and resume.file_url and resume.file_url.startswith("http") and not force:
        logger.info("SKIP  (already on S3) | %s → %s", local_str, resume.file_url)
        stats["skipped"] += 1
        return

    file_size = file_path.stat().st_size
    logger.info(
        "%s | user=%-20s | %s  (%d KB)",
        "DRY-RUN" if dry_run else "UPLOAD ",
        user_id,
        file_path.name,
        file_size // 1024,
    )

    if dry_run:
        stats["dry_run"] += 1
        return

    # ── Upload to S3 ──────────────────────────────────────────────────────
    try:
        file_bytes = file_path.read_bytes()
        s3_url = await storage_service.upload_file(
            file_bytes=file_bytes,
            filename=file_path.name,
            user_id=user_id,
        )
        logger.info("  ✅ uploaded → %s", s3_url)
        stats["uploaded"] += 1
    except Exception as exc:
        logger.error("  ❌ upload failed | %s | %s", file_path.name, exc)
        stats["failed"] += 1
        return

    # ── Update DB record ──────────────────────────────────────────────────
    if resume:
        try:
            resume.file_url = s3_url
            db.commit()
            logger.info("  📝 DB updated | resume_id=%s", resume.id)
            stats["db_updated"] += 1
        except Exception as exc:
            logger.error("  ❌ DB update failed | resume_id=%s | %s", resume.id, exc)
            db.rollback()
    else:
        logger.warning(
            "  ⚠️  No DB record found for path=%s — file uploaded but DB not updated. "
            "You may need to create/update the Resume record manually.",
            local_str,
        )
        stats["no_record"] += 1


async def run(src_dir: Path, dry_run: bool, force: bool) -> None:
    """Main migration loop."""
    # ── Pre-flight checks ─────────────────────────────────────────────────
    if not settings.s3_is_configured:
        logger.error(
            "❌ S3 is not configured. "
            "Set S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY "
            "(and AWS_ENDPOINT_URL for Cloudflare R2) in .env before running this script."
        )
        sys.exit(1)

    if not src_dir.is_dir():
        logger.error("❌ Source directory does not exist: %s", src_dir)
        sys.exit(1)

    # ── Test S3 connection ────────────────────────────────────────────────
    logger.info("🔗 Testing S3 connection…")
    reachable = await storage_service.ping()
    if not reachable:
        logger.error(
            "❌ S3 bucket unreachable (bucket=%s, endpoint=%s). "
            "Check credentials and network.",
            settings.s3_bucket_name,
            settings.s3_endpoint_url or "AWS default",
        )
        sys.exit(1)
    logger.info("  ✅ S3 bucket reachable: %s", settings.s3_bucket_name)

    # ── Discover files ────────────────────────────────────────────────────
    files = _discover_files(src_dir)
    if not files:
        logger.info("No files found in %s — nothing to migrate.", src_dir)
        return

    logger.info("")
    logger.info("══════════════════════════════════════════")
    logger.info("  Skillmate AI — Upload Migration")
    logger.info("  Source:  %s", src_dir)
    logger.info("  Bucket:  %s", settings.s3_bucket_name)
    logger.info("  Files:   %d", len(files))
    logger.info("  Dry-run: %s", dry_run)
    logger.info("  Force:   %s", force)
    logger.info("══════════════════════════════════════════")
    logger.info("")

    stats: dict = {
        "uploaded": 0,
        "skipped": 0,
        "failed": 0,
        "dry_run": 0,
        "db_updated": 0,
        "no_record": 0,
    }

    db = SessionLocal()
    try:
        for i, file_path in enumerate(files, 1):
            logger.info("[%d/%d]", i, len(files))
            await _migrate_file(file_path, db, dry_run, force, stats)
    finally:
        db.close()

    # ── Summary ───────────────────────────────────────────────────────────
    logger.info("")
    logger.info("══════════════════════════════════════════")
    logger.info("  Migration complete")
    logger.info("  Uploaded:     %d", stats["uploaded"])
    logger.info("  Skipped:      %d  (already on S3)", stats["skipped"])
    logger.info("  Dry-run:      %d  (would upload)", stats["dry_run"])
    logger.info("  Failed:       %d  ❌", stats["failed"])
    logger.info("  DB updated:   %d", stats["db_updated"])
    logger.info("  No DB record: %d  ⚠️", stats["no_record"])
    logger.info("══════════════════════════════════════════")

    if stats["failed"] > 0:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate local resume uploads to S3/R2 and update DB records."
    )
    parser.add_argument(
        "--src",
        type=Path,
        default=Path(settings.upload_dir),
        help=f"Source directory to scan (default: {settings.upload_dir})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without actually uploading.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-upload files that already have an S3 URL in the DB.",
    )
    args = parser.parse_args()

    asyncio.run(run(src_dir=args.src, dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
