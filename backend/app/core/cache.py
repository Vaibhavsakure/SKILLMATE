"""
Skillmate AI — Redis Cache Layer
==================================
Provides:
  - Async Redis singleton (aioredis >= 2.0)
  - cache_get / cache_set / cache_invalidate helpers
  - Graceful degradation: if Redis is unavailable, all helpers return
    None / no-op so the caller falls through to the real computation.

Usage:
    from app.core.cache import cache_get, cache_set, cache_invalidate

    key = f"ats:{user_id}:{hash(resume_text + jd_text)}"
    cached = await cache_get(key)
    if cached:
        return cached
    result = expensive_call()
    await cache_set(key, result, ttl=3600)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from app.core.config import settings

logger = logging.getLogger("skillmate.cache")

# ---------------------------------------------------------------------------
# Redis client singleton
# ---------------------------------------------------------------------------

_redis = None            # module-level singleton; created lazily on first use
_connect_lock = asyncio.Lock()
_next_retry_at = 0.0     # epoch seconds; while in the future we skip connecting

# How long to stay in "Redis is down" mode before trying to reconnect. Without
# this, every request pays the socket_connect_timeout when Redis is unreachable.
_RETRY_BACKOFF_SECONDS = 30


async def _get_client():
    """
    Return the shared Redis client, creating it on the first call.

    Returns None (with a warning) if Redis is unavailable or not configured.
    After a failed connection we back off for _RETRY_BACKOFF_SECONDS so a down
    Redis doesn't add the connect timeout to every single request.
    """
    global _redis, _next_retry_at

    if _redis is not None:
        return _redis

    if time.monotonic() < _next_retry_at:
        return None

    async with _connect_lock:
        # Another coroutine may have connected while we waited for the lock.
        if _redis is not None:
            return _redis
        if time.monotonic() < _next_retry_at:
            return None

        redis_url: str = settings.redis_url

        try:
            # redis-py >= 4.2 ships the asyncio client. The old standalone
            # `aioredis` package is unmaintained and fails to import on
            # Python 3.11+ (duplicate base class TimeoutError).
            import redis.asyncio as aioredis

            client = aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,   # fail fast if Redis is down
                socket_timeout=2,
            )
            # Verify connectivity
            await client.ping()
            _redis = client
            _next_retry_at = 0.0
            logger.info(f"✅ Redis connected: {redis_url}")
        except Exception as exc:
            _next_retry_at = time.monotonic() + _RETRY_BACKOFF_SECONDS
            logger.warning(
                f"⚠️  Redis unavailable — caching disabled for "
                f"{_RETRY_BACKOFF_SECONDS}s. Reason: {exc}"
            )
            _redis = None

    return _redis


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def cache_get(key: str) -> dict | None:
    """
    Retrieve a cached JSON value.

    Returns the deserialized dict on a cache hit, or None on a miss /
    Redis unavailability.
    """
    client = await _get_client()
    if client is None:
        return None

    try:
        raw = await client.get(key)
        if raw is None:
            return None
        logger.debug(f"Cache HIT: {key}")
        return json.loads(raw)
    except Exception as exc:
        logger.warning(f"cache_get failed for key={key}: {exc}")
        return None


async def cache_set(key: str, data: Any, ttl: int = 3600) -> None:
    """
    Store a JSON-serialisable value in Redis.

    Args:
        key:  Cache key string.
        data: Any JSON-serialisable object (dict, list, etc.).
        ttl:  Time-to-live in seconds (default 1 hour).
    """
    client = await _get_client()
    if client is None:
        return

    try:
        await client.set(key, json.dumps(data, default=str), ex=ttl)
        logger.debug(f"Cache SET: {key} (ttl={ttl}s)")
    except Exception as exc:
        logger.warning(f"cache_set failed for key={key}: {exc}")


async def cache_invalidate(prefix: str, user_id: str) -> int:
    """
    Delete all Redis keys matching the pattern ``{prefix}:{user_id}:*``.

    Returns the number of keys deleted (0 if Redis is unavailable).

    Example:
        await cache_invalidate("ats", user_id)   # clears all ATS caches for user
    """
    client = await _get_client()
    if client is None:
        return 0

    pattern = f"{prefix}:{user_id}:*"
    deleted = 0
    try:
        # SCAN is non-blocking unlike KEYS in production
        async for key in client.scan_iter(match=pattern, count=100):
            await client.delete(key)
            deleted += 1
        if deleted:
            logger.info(f"Cache INVALIDATE: pattern={pattern}, deleted={deleted}")
    except Exception as exc:
        logger.warning(f"cache_invalidate failed for pattern={pattern}: {exc}")

    return deleted
