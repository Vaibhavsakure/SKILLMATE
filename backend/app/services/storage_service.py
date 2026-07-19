"""
Skillmate AI — Cloud Storage Service
======================================
S3-compatible file storage using boto3.
Works with AWS S3 and Cloudflare R2 (set S3_ENDPOINT_URL for R2).

Usage:
    from app.services.storage_service import storage_service

    url  = await storage_service.upload_file(file_bytes, "resume.pdf", user_id)
    ok   = await storage_service.delete_file(url)
    link = await storage_service.get_signed_url("resumes/user123/abc.pdf", expires=3600)

Notes:
    - boto3 is synchronous; we run it in a thread pool to keep FastAPI async.
    - If S3_BUCKET_NAME is not configured, upload_file() raises RuntimeError
      so callers can fall back to local storage during development.
"""

from __future__ import annotations

import asyncio
import logging
import mimetypes
import uuid
from functools import partial
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("skillmate.storage")

# ---------------------------------------------------------------------------
# boto3 client — built lazily on first use
# ---------------------------------------------------------------------------

_s3 = None   # module-level singleton


def _get_client():
    """
    Build (or return the cached) boto3 S3 client.
    Thread-safe: called from run_in_executor so only one thread at a time.
    """
    global _s3
    if _s3 is not None:
        return _s3

    if not settings.s3_bucket_name:
        raise RuntimeError(
            "S3_BUCKET_NAME is not configured. "
            "Set S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in .env"
        )

    import boto3  # lazy — not installed in dev unless needed

    kwargs: dict = {
        "aws_access_key_id":     settings.aws_access_key_id,
        "aws_secret_access_key": settings.aws_secret_access_key,
    }
    # Cloudflare R2 (and MinIO, Backblaze B2, etc.) need a custom endpoint
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url

    _s3 = boto3.client("s3", **kwargs)
    logger.info(
        f"✅ S3 client ready — bucket={settings.s3_bucket_name} "
        f"endpoint={settings.s3_endpoint_url or 'AWS default'}"
    )
    return _s3


# ---------------------------------------------------------------------------
# StorageService
# ---------------------------------------------------------------------------

class StorageService:
    """
    Async wrapper around boto3 S3 operations.
    All network I/O runs in the default thread-pool executor so it never
    blocks the FastAPI event loop.
    """

    # ── helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _make_key(filename: str, user_id: str) -> str:
        """
        Build an S3 object key with the pattern:
            resumes/{user_id}/{uuid}{ext}

        UUID prefix avoids filename collisions across users.
        """
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()
        unique = uuid.uuid4().hex
        return f"resumes/{user_id}/{unique}{ext}"

    @staticmethod
    def _public_url(key: str) -> str:
        """
        Build the public URL for an object.

        • If S3_PUBLIC_URL is set (e.g. a CDN or R2 custom domain),
          use it directly: https://cdn.example.com/{key}
        • Otherwise fall back to the standard AWS S3 path-style URL.
        """
        if settings.s3_public_url:
            base = settings.s3_public_url.rstrip("/")
            return f"{base}/{key}"

        # AWS path-style fallback
        bucket = settings.s3_bucket_name
        return f"https://{bucket}.s3.amazonaws.com/{key}"

    @staticmethod
    def _key_from_url(url: str) -> Optional[str]:
        """
        Extract the S3 object key from a public URL produced by _public_url().
        Returns None if the URL cannot be parsed.
        """
        # CDN or R2 custom domain: https://cdn.example.com/resumes/user/file.pdf
        if settings.s3_public_url:
            base = settings.s3_public_url.rstrip("/") + "/"
            if url.startswith(base):
                return url[len(base):]

        # AWS path-style: https://bucket.s3.amazonaws.com/key
        bucket = settings.s3_bucket_name
        marker = f"{bucket}.s3.amazonaws.com/"
        if marker in url:
            return url.split(marker, 1)[1]

        return None

    # ── Public API ─────────────────────────────────────────────────────────

    async def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        user_id: str,
    ) -> str:
        """
        Upload raw file bytes to S3/R2.

        Args:
            file_bytes: Raw file content (already read from UploadFile).
            filename:   Original filename (used to determine extension).
            user_id:    Owning user's ID (used to namespace the key).

        Returns:
            Public URL string for the uploaded object.

        Raises:
            RuntimeError: If S3 is not configured.
            Exception:    boto3 / network errors bubble up.
        """
        key = self._make_key(filename, user_id)
        content_type, _ = mimetypes.guess_type(filename)
        content_type = content_type or "application/octet-stream"

        def _put():
            client = _get_client()
            client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _put)

        url = self._public_url(key)
        logger.info(f"Uploaded {filename} → {url} ({len(file_bytes)} bytes)")
        return url

    async def delete_file(self, file_url: str) -> bool:
        """
        Delete an object by its public URL.

        Returns:
            True on success, False if the URL cannot be resolved or the
            delete operation fails.
        """
        key = self._key_from_url(file_url)
        if not key:
            logger.warning(f"delete_file: could not resolve key from URL: {file_url}")
            return False

        def _delete():
            client = _get_client()
            client.delete_object(Bucket=settings.s3_bucket_name, Key=key)

        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _delete)
            logger.info(f"Deleted S3 object: {key}")
            return True
        except Exception as exc:
            logger.error(f"delete_file failed for key={key}: {exc}")
            return False

    async def get_signed_url(
        self,
        file_key: str,
        expires: int = 3600,
    ) -> str:
        """
        Generate a pre-signed URL that grants temporary read access.

        Args:
            file_key: S3 object key (NOT the full public URL).
            expires:  Expiry in seconds (default 1 hour).

        Returns:
            A signed URL string valid for `expires` seconds.
        """
        def _sign():
            client = _get_client()
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.s3_bucket_name, "Key": file_key},
                ExpiresIn=expires,
            )

        loop = asyncio.get_event_loop()
        signed = await loop.run_in_executor(None, _sign)
        logger.debug(f"Signed URL generated for key={file_key} (expires={expires}s)")
        return signed


# Singleton — import this everywhere
storage_service = StorageService()
