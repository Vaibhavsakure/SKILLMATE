"""
Job Description Scraper API — Extracts JD text from job posting URLs.
"""

import logging
import re
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

import httpx

from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


class ScrapeRequest(BaseModel):
    url: str = Field(..., min_length=10)


class ScrapeResponse(BaseModel):
    title: str
    description: str
    source: str


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

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()

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
