"""
Skillmate Backend — Unified AI Service v4.0
=============================================
Primary: Anthropic Claude (cloud)
Fallback 1: Groq (cloud, fast & cheap)
Fallback 2: Ollama (local)

Features:
- Triple-provider fallback chain
- Automatic retry with exponential backoff
- Rate-limit detection & graceful degradation
"""

import json
import asyncio
import logging
import time
import threading
from typing import Dict, Any, List, Optional

import httpx

from app.core.config import settings

# --- Setup ---
logger = logging.getLogger(__name__)

# --- Initialize Anthropic Claude (Async) ---
_claude_client = None
# Current fast/cheap tier. The previous value, claude-3-haiku-20240307, is a
# legacy Claude 3 model. Same tier, same intent — just the shipping ID.
_claude_model = "claude-haiku-4-5"

if settings.anthropic_api_key:
    try:
        import anthropic
        _claude_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        logger.info(f"✅ Claude AI initialized (async, {_claude_model})")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Claude: {e}")

# --- Initialize Groq (Async) ---
_groq_client = None
_groq_model = "llama-3.1-8b-instant"

if settings.groq_api_key:
    try:
        from groq import AsyncGroq
        _groq_client = AsyncGroq(api_key=settings.groq_api_key)
        logger.info(f"✅ Groq AI initialized (async, {_groq_model})")
    except Exception as e:
        logger.warning(f"⚠️ Groq init failed (will skip): {e}")

# Ollama fallback config
_ollama_url = f"{settings.ollama_base_url}/api/generate"
_ollama_chat_url = f"{settings.ollama_base_url}/api/chat"
_ollama_model = "llama3.1"


# --- Retry Decorator ---
async def _retry_async(func, max_retries: int = 2, backoff: float = 1.0):
    """Retry an async function with exponential backoff."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return await func()
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait_time = backoff * (2 ** attempt)
                logger.warning(
                    f"Retry {attempt + 1}/{max_retries} after {wait_time:.1f}s: {e}"
                )
                await asyncio.sleep(wait_time)
    raise last_error


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------

class CircuitBreaker:
    """
    Per-provider circuit breaker.

    State machine:
        CLOSED    — normal operation; failures accumulate in a sliding window.
        OPEN      — provider is skipped; opened after `failure_threshold`
                    failures within `window_seconds`.
        HALF_OPEN — one trial attempt allowed after `recovery_timeout` seconds;
                    success → CLOSED, failure → OPEN again.
    """

    failure_threshold: int = 3   # failures within window to trip the breaker
    window_seconds: int = 60     # sliding window for counting failures
    recovery_timeout: int = 30   # seconds in OPEN before moving to HALF_OPEN

    def __init__(self, name: str) -> None:
        self.name = name
        self._lock = threading.Lock()
        self._failure_times: list = []   # epoch timestamps of recent failures
        self._opened_at: float | None = None

    # ── Public interface ────────────────────────────────────────────────────

    def state(self) -> str:
        """Return current state string: 'closed' | 'open' | 'half_open'."""
        with self._lock:
            return self._current_state()

    def can_attempt(self) -> bool:
        """
        Return True when a request may be forwarded to this provider.
        Allows attempts in CLOSED and HALF_OPEN states only.
        """
        with self._lock:
            return self._current_state() in ("closed", "half_open")

    def record_success(self) -> None:
        """Call after a provider responds successfully."""
        with self._lock:
            prev = self._current_state()
            self._failure_times.clear()
            self._opened_at = None
            if prev != "closed":
                logger.info(
                    f"CircuitBreaker[{self.name}]: {prev} → closed"
                )

    def record_failure(self) -> None:
        """Call whenever a provider raises an exception."""
        with self._lock:
            now = time.time()
            # Trim failures that have aged out of the sliding window
            self._failure_times = [
                t for t in self._failure_times if now - t < self.window_seconds
            ]
            self._failure_times.append(now)

            if (
                len(self._failure_times) >= self.failure_threshold
                and self._opened_at is None
            ):
                self._opened_at = now
                logger.warning(
                    f"CircuitBreaker[{self.name}]: closed → open "
                    f"({self.failure_threshold} failures in {self.window_seconds}s)"
                )

    # ── Private ─────────────────────────────────────────────────────────────

    def _current_state(self) -> str:
        """Compute state from internal data. Must be called with _lock held."""
        if self._opened_at is None:
            return "closed"
        elapsed = time.time() - self._opened_at
        if elapsed >= self.recovery_timeout:
            return "half_open"
        return "open"


# One breaker instance per provider (module-level singletons)
_cb_claude = CircuitBreaker("claude")
_cb_groq   = CircuitBreaker("groq")
_cb_ollama = CircuitBreaker("ollama")


class AIService:
    """Unified AI service — tries Claude → Groq → Ollama with retry logic."""

    # ------------------------------------------------------------------ #
    #  Internal helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _clean_json_response(content: str) -> str:
        """Removes markdown fences from JSON strings."""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()

    # ------------------------------------------------------------------ #
    #  Claude backends
    # ------------------------------------------------------------------ #

    async def _claude_json(self, prompt: str) -> Dict[str, Any]:
        """Get structured JSON from Claude."""
        if not _claude_client:
            raise RuntimeError("Claude not configured")

        async def _call():
            message = await _claude_client.messages.create(
                model=_claude_model,
                max_tokens=2048,
                temperature=0.2,
                messages=[
                    {"role": "user", "content": prompt + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation."}
                ],
            )
            raw = message.content[0].text.strip()
            clean = self._clean_json_response(raw)
            return json.loads(clean)

        return await _retry_async(_call, max_retries=1, backoff=0.5)

    async def _claude_text(self, prompt: str) -> str:
        """Get plain-text from Claude."""
        if not _claude_client:
            raise RuntimeError("Claude not configured")

        async def _call():
            message = await _claude_client.messages.create(
                model=_claude_model,
                max_tokens=4096,
                temperature=0.7,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            )
            return message.content[0].text.strip()

        return await _retry_async(_call, max_retries=1, backoff=0.5)

    async def _claude_chat(self, messages: List[dict]) -> str:
        """Chat via Claude with message history."""
        if not _claude_client:
            raise RuntimeError("Claude not configured")

        # Convert messages to Claude format
        # Claude requires alternating user/assistant, system goes in system param
        system_prompt = ""
        claude_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
            else:
                claude_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        # Ensure messages alternate properly — merge consecutive same-role messages
        merged = []
        for msg in claude_messages:
            if merged and merged[-1]["role"] == msg["role"]:
                merged[-1]["content"] += "\n" + msg["content"]
            else:
                merged.append(msg)

        # Claude requires first message to be from user
        if not merged or merged[0]["role"] != "user":
            merged.insert(0, {"role": "user", "content": "Hello"})

        kwargs = {
            "model": _claude_model,
            "max_tokens": 2048,
            "temperature": 0.7,
            "messages": merged,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        async def _call():
            message = await _claude_client.messages.create(**kwargs)
            return message.content[0].text.strip()

        return await _retry_async(_call, max_retries=1, backoff=0.5)

    # ------------------------------------------------------------------ #
    #  Groq backends (NEW — Fallback 1)
    # ------------------------------------------------------------------ #

    async def _groq_json(self, prompt: str) -> Dict[str, Any]:
        """Get structured JSON from Groq."""
        if not _groq_client:
            raise RuntimeError("Groq not configured")

        async def _call():
            completion = await _groq_client.chat.completions.create(
                model=_groq_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant. Return ONLY valid JSON. No markdown, no explanation."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            raw = completion.choices[0].message.content.strip()
            clean = self._clean_json_response(raw)
            return json.loads(clean)

        return await _retry_async(_call, max_retries=1, backoff=0.3)

    async def _groq_text(self, prompt: str) -> str:
        """Get plain-text from Groq."""
        if not _groq_client:
            raise RuntimeError("Groq not configured")

        async def _call():
            completion = await _groq_client.chat.completions.create(
                model=_groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=4096,
            )
            return completion.choices[0].message.content.strip()

        return await _retry_async(_call, max_retries=1, backoff=0.3)

    async def _groq_chat(self, messages: List[dict]) -> str:
        """Chat via Groq."""
        if not _groq_client:
            raise RuntimeError("Groq not configured")

        async def _call():
            completion = await _groq_client.chat.completions.create(
                model=_groq_model,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
            )
            return completion.choices[0].message.content.strip()

        return await _retry_async(_call, max_retries=1, backoff=0.3)

    # ------------------------------------------------------------------ #
    #  Ollama backends
    # ------------------------------------------------------------------ #

    async def _ollama_json(self, prompt: str) -> Dict[str, Any]:
        """Get structured JSON from Ollama."""
        payload = {
            "model": _ollama_model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(_ollama_url, json=payload)
            resp.raise_for_status()
            content = resp.json().get("response", "{}")
            clean = self._clean_json_response(content)
            return json.loads(clean)

    async def _ollama_text(self, prompt: str) -> str:
        """Get plain-text from Ollama."""
        payload = {
            "model": _ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.7},
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(_ollama_url, json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "").strip()

    async def _ollama_chat(self, messages: List[dict]) -> str:
        """Chat via Ollama."""
        payload = {
            "model": _ollama_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.7},
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(_ollama_chat_url, json=payload)
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "").strip()

    # ------------------------------------------------------------------ #
    #  Public API  (Claude → Groq → Ollama fallback chain)
    # ------------------------------------------------------------------ #

    async def generate_json(self, prompt: str) -> Dict[str, Any]:
        """Returns a parsed JSON dict from the LLM."""
        logger.info(f"AI JSON request (first 60 chars): {prompt[:60]}...")

        # Try Claude first
        if _claude_client and _cb_claude.can_attempt():
            try:
                result = await self._claude_json(prompt)
                _cb_claude.record_success()
                return result
            except Exception as e:
                _cb_claude.record_failure()
                logger.warning(f"Claude JSON failed: {e}")
        elif _claude_client:
            logger.info("CircuitBreaker[claude]: OPEN — skipping Claude for JSON")

        # Fallback 1: Groq
        if _groq_client and _cb_groq.can_attempt():
            try:
                logger.info("Falling back to Groq for JSON...")
                result = await self._groq_json(prompt)
                _cb_groq.record_success()
                return result
            except Exception as e:
                _cb_groq.record_failure()
                logger.warning(f"Groq JSON failed: {e}")
        elif _groq_client:
            logger.info("CircuitBreaker[groq]: OPEN — skipping Groq for JSON")

        # Fallback 2: Ollama
        if _cb_ollama.can_attempt():
            try:
                logger.info("Falling back to Ollama for JSON...")
                result = await self._ollama_json(prompt)
                _cb_ollama.record_success()
                return result
            except Exception as e:
                _cb_ollama.record_failure()
                logger.error(f"All AI backends failed for JSON: {e}")
        else:
            logger.error("CircuitBreaker[ollama]: OPEN — all providers unavailable")

        return {}

    async def generate_text(self, prompt: str) -> str:
        """Returns a plain-text response from the LLM."""
        logger.info(f"AI text request (first 60 chars): {prompt[:60]}...")

        if _claude_client and _cb_claude.can_attempt():
            try:
                result = await self._claude_text(prompt)
                _cb_claude.record_success()
                return result
            except Exception as e:
                _cb_claude.record_failure()
                logger.warning(f"Claude text failed: {e}")
        elif _claude_client:
            logger.info("CircuitBreaker[claude]: OPEN — skipping Claude for text")

        if _groq_client and _cb_groq.can_attempt():
            try:
                logger.info("Falling back to Groq for text...")
                result = await self._groq_text(prompt)
                _cb_groq.record_success()
                return result
            except Exception as e:
                _cb_groq.record_failure()
                logger.warning(f"Groq text failed: {e}")
        elif _groq_client:
            logger.info("CircuitBreaker[groq]: OPEN — skipping Groq for text")

        if _cb_ollama.can_attempt():
            try:
                logger.info("Falling back to Ollama for text...")
                result = await self._ollama_text(prompt)
                _cb_ollama.record_success()
                return result
            except Exception as e:
                _cb_ollama.record_failure()
                logger.error(f"All AI backends failed for text: {e}")
                return f"AI service temporarily unavailable: {e}"
        else:
            logger.error("CircuitBreaker[ollama]: OPEN — all providers unavailable")

        return "AI service temporarily unavailable: all circuit breakers open"

    async def chat(self, messages: List[dict]) -> str:
        """Conversational chat. Messages: [{"role": "user", "content": "..."}]"""
        logger.info(f"AI chat request ({len(messages)} messages)")

        if _claude_client and _cb_claude.can_attempt():
            try:
                result = await self._claude_chat(messages)
                _cb_claude.record_success()
                return result
            except Exception as e:
                _cb_claude.record_failure()
                logger.warning(f"Claude chat failed: {e}")
        elif _claude_client:
            logger.info("CircuitBreaker[claude]: OPEN — skipping Claude for chat")

        if _groq_client and _cb_groq.can_attempt():
            try:
                logger.info("Falling back to Groq for chat...")
                result = await self._groq_chat(messages)
                _cb_groq.record_success()
                return result
            except Exception as e:
                _cb_groq.record_failure()
                logger.warning(f"Groq chat failed: {e}")
        elif _groq_client:
            logger.info("CircuitBreaker[groq]: OPEN — skipping Groq for chat")

        if _cb_ollama.can_attempt():
            try:
                logger.info("Falling back to Ollama for chat...")
                result = await self._ollama_chat(messages)
                _cb_ollama.record_success()
                return result
            except Exception as e:
                _cb_ollama.record_failure()
                logger.error(f"All AI backends failed for chat: {e}")
        else:
            logger.error("CircuitBreaker[ollama]: OPEN — all providers unavailable")

        return "I'm having trouble connecting right now. Please try again later."

    async def generate_json_strict(self, prompt: str) -> Dict[str, Any]:
        """
        Like generate_json but raises an exception if all providers fail
        instead of returning an empty dict. Use for critical paths.
        """
        result = await self.generate_json(prompt)
        if not result:
            raise RuntimeError("All AI providers failed to generate JSON response")
        return result


# Singleton instance — import this everywhere
ai_service = AIService()
