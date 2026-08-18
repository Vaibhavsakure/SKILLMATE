"""
Job Description Scraper API — Extracts JD text from job posting URLs.
"""

import ipaddress
import logging
import re
import socket
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

import httpx

from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# --- SSRF guard configuration ---
# This endpoint fetches a user-supplied URL and returns the body, so without
# these checks it is a proxy into anything the backend can reach: cloud
# metadata (169.254.169.254), other containers on the compose network, and
# localhost services such as /metrics or the Postgres admin port.
_ALLOWED_SCHEMES = {"http", "https"}
_MAX_REDIRECTS = 3
_MAX_RESPONSE_BYTES = 3 * 1024 * 1024   # 3 MB is plenty for a job posting


class ScrapeRequest(BaseModel):
    url: str = Field(..., min_length=10)


class ScrapeResponse(BaseModel):
    title: str
    description: str
    source: str


async def _assert_public_url(url: str) -> None:
    """
    Raise 400 unless `url` is an http(s) URL whose host resolves exclusively to
    public, routable IP addresses.
    """
    parsed = urlparse(url)

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise HTTPException(
            status_code=400,
            detail="Only http:// and https:// URLs can be scraped.",
        )

    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="URL is missing a hostname.")

    try:
        # getaddrinfo is blocking — keep it off the event loop.
        infos = await run_in_threadpool(
            socket.getaddrinfo, host, parsed.port or (443 if parsed.scheme == "https" else 80),
            0, socket.SOCK_STREAM,
        )
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve that hostname.")

    if not infos:
        raise HTTPException(status_code=400, detail="Could not resolve that hostname.")

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            raise HTTPException(status_code=400, detail="Could not resolve that hostname.")

        # Rejects loopback, RFC1918, link-local (incl. 169.254.169.254),
        # unique-local IPv6, multicast, and reserved ranges.
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            logger.warning(f"Blocked SSRF attempt to {host} ({ip})")
            raise HTTPException(
                status_code=400,
                detail="That URL points to a private or internal address.",
            )


async def _fetch_public_url(client: httpx.AsyncClient, url: str, headers: dict) -> httpx.Response:
    """
    GET `url`, re-validating the target before every redirect hop.

    httpx's own follow_redirects would only let us check the first URL, so a
    public host that 302s to 169.254.169.254 would slip straight through.
    """
    current = url
    for _ in range(_MAX_REDIRECTS + 1):
        await _assert_public_url(current)
        resp = await client.get(current, headers=headers)

        if resp.is_redirect and resp.headers.get("location"):
            current = str(resp.next_request.url) if resp.next_request else resp.headers["location"]
            continue

        return resp

    raise HTTPException(status_code=422, detail="Too many redirects while fetching that URL.")


def _clean_html_text(html: str) -> str:
    """Remove HTML tags and clean up whitespace."""
    # Remove script and style blocks
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


@router.post("/scrape-url", response_model=ScrapeResponse)
async def scrape_job_url(
    data: ScrapeRequest,
    user: dict = Depends(get_current_user),
):
    """Scrapes a job posting URL and extracts the job description text."""

    url = data.url.strip()

    # Determine source
    source = "unknown"
    if "linkedin.com" in url:
        source = "linkedin"
    elif "indeed.com" in url:
        source = "indeed"
    elif "glassdoor.com" in url:
        source = "glassdoor"
    elif "lever.co" in url or "greenhouse.io" in url:
        source = "ats"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        }

        # follow_redirects=False: _fetch_public_url walks the chain itself so
        # every hop is re-checked against the SSRF guard.
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            resp = await _fetch_public_url(client, url, headers)
            resp.raise_for_status()

            if len(resp.content) > _MAX_RESPONSE_BYTES:
                raise HTTPException(
                    status_code=422,
                    detail="That page is too large to parse. Paste the job description instead.",
                )

        html = resp.text

        # Try BeautifulSoup if available
        title = ""
        description = ""

        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")

            # Extract title
            title_tag = soup.find("title")
            title = title_tag.get_text(strip=True) if title_tag else ""

            # Try common JD containers
            jd_selectors = [
                {"class_": re.compile(r"job.?description|job.?details|description.?body", re.I)},
                {"class_": re.compile(r"posting.?body|content.?body", re.I)},
                {"id": re.compile(r"job.?description|job.?details", re.I)},
            ]

            for selector in jd_selectors:
                container = soup.find("div", selector) or soup.find("section", selector)
                if container:
                    description = container.get_text(separator="\n", strip=True)
                    break

            # Fallback: get main/article content
            if not description or len(description) < 100:
                for tag in ["article", "main"]:
                    el = soup.find(tag)
                    if el:
                        description = el.get_text(separator="\n", strip=True)
                        break

            # Last resort: body text
            if not description or len(description) < 100:
                body = soup.find("body")
                if body:
                    description = body.get_text(separator="\n", strip=True)

        except ImportError:
            # Fallback without BeautifulSoup
            # Extract title
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else ""
            description = _clean_html_text(html)

        # Truncate if too long
        if len(description) > 8000:
            description = description[:8000] + "\n\n[Truncated...]"

        if len(description) < 50:
            raise HTTPException(
                status_code=422,
                detail="Could not extract meaningful content from this URL. Try pasting the job description manually."
            )

        logger.info(f"Scraped JD from {source} for user {user.get('id')}: {len(description)} chars")

        return ScrapeResponse(
            title=title[:200] if title else "Job Posting",
            description=description,
            source=source,
        )

    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error scraping {url}: {e}")
        raise HTTPException(status_code=422, detail=f"Could not access URL (HTTP {e.response.status_code})")
    except Exception as e:
        logger.error(f"Scrape error for {url}: {e}")
        raise HTTPException(status_code=500, detail="Failed to scrape URL. Try pasting the job description manually.")
