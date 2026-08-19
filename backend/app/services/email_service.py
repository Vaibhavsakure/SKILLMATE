"""
Skillmate AI — Async Email Service
=====================================
Sends transactional HTML emails via aiosmtplib (STARTTLS).

All public methods are fire-and-forget safe: they log errors but never
raise, so a downstream SMTP outage can never crash a request handler.

Usage:
    from app.services.email_service import email_service
    await email_service.send_welcome("user@example.com", "Alice")

Requires in .env:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
"""

from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("skillmate.email")


# ---------------------------------------------------------------------------
# Shared HTML wrapper
# ---------------------------------------------------------------------------

_BRAND_COLOR = "#6C5CE7"
_BG_COLOR = "#0F0F1A"
_CARD_BG = "#1A1A2E"
_TEXT_COLOR = "#E0E0E0"
_MUTED = "#A0A0B0"


def _base_html(title: str, body_content: str) -> str:
    """Wrap body_content in a branded HTML email shell."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:{_BG_COLOR};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:{_CARD_BG};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(108,92,231,.25);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,{_BRAND_COLOR},#a29bfe);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;font-size:28px;color:#fff;letter-spacing:-0.5px;">✦ Skillmate AI</h1>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:36px 40px;color:{_TEXT_COLOR};font-size:15px;line-height:1.7;">
    {body_content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:20px 40px 28px;text-align:center;color:{_MUTED};font-size:12px;border-top:1px solid #2a2a3e;">
    &copy; 2026 Skillmate AI &middot; AI-Powered Career Intelligence<br>
    <a href="{settings.frontend_url}/terms" style="color:{_MUTED};text-decoration:underline;">Terms</a> &middot;
    <a href="{settings.frontend_url}/privacy" style="color:{_MUTED};text-decoration:underline;">Privacy</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def _button(href: str, label: str) -> str:
    """Render a CTA button."""
    return (
        f'<table cellpadding="0" cellspacing="0" style="margin:28px auto;">'
        f'<tr><td style="background:{_BRAND_COLOR};border-radius:8px;">'
        f'<a href="{href}" target="_blank" style="display:inline-block;'
        f'padding:14px 36px;color:#fff;font-size:15px;font-weight:600;'
        f'text-decoration:none;letter-spacing:0.3px;">{label}</a>'
        f'</td></tr></table>'
    )


# ---------------------------------------------------------------------------
# EmailService
# ---------------------------------------------------------------------------

class EmailService:
    """Async transactional email sender using aiosmtplib."""

    # ── Core send method ───────────────────────────────────────────────────

    async def _send(
        self,
        to_email: str,
        subject: str,
        html_body: str,
    ) -> bool:
        """
        Send a single HTML email.

        Returns True on success, False on any failure (logged, never raised).
        """
        # Guard: skip silently if SMTP is not configured (dev mode)
        if not settings.smtp_host or not settings.smtp_user:
            logger.debug(
                f"Email skipped (SMTP not configured): to={to_email} subject={subject!r}"
            )
            return False

        try:
            import aiosmtplib  # lazy import — optional dependency

            msg = MIMEMultipart("alternative")
            msg["From"] = settings.email_from
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=True,
            )
            logger.info(f"📧 Email sent: to={to_email} subject={subject!r}")
            return True

        except Exception as exc:
            logger.warning(
                f"📧 Email FAILED: to={to_email} subject={subject!r} error={exc}"
            )
            return False

    # ── Public convenience methods ─────────────────────────────────────────

    async def send_welcome(self, to_email: str, name: str) -> bool:
        """
        Sent once when a new user account is created.
        """
        first_name = name.split()[0] if name else "there"
        dashboard_url = f"{settings.frontend_url}/dashboard"

        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">Welcome aboard, {first_name}! 🎉</h2>
<p>Your Skillmate AI account is ready. Here's what you can do right away:</p>
<ul style="padding-left:20px;">
  <li><strong>ATS Scanner</strong> — Check resume compatibility in seconds</li>
  <li><strong>AI Resume Rewriter</strong> — Tailor your resume for any job</li>
  <li><strong>Interview Coach</strong> — Practice with AI-generated questions</li>
  <li><strong>Career Roadmap</strong> — Get a personalised learning plan</li>
</ul>
<p>You start with <strong>10 free credits</strong> — enough to try every tool.</p>
{_button(dashboard_url, "Go to Dashboard →")}
<p style="color:{_MUTED};font-size:13px;">
  If you didn't create this account, you can safely ignore this email.
</p>"""

        return await self._send(to_email, "Welcome to Skillmate AI ✦", _base_html("Welcome", body))

    async def send_credits_purchased(
        self,
        to_email: str,
        name: str,
        credits: int,
        amount_usd: str,
    ) -> bool:
        """
        Confirmation after a successful credit purchase via Stripe.
        """
        first_name = name.split()[0] if name else "there"
        dashboard_url = f"{settings.frontend_url}/dashboard/credits"

        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">Payment Confirmed ✅</h2>
<p>Hey {first_name}, your credit purchase was successful!</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr>
    <td style="padding:12px 16px;background:#222240;border-radius:8px 8px 0 0;color:{_MUTED};font-size:13px;">Credits Added</td>
    <td style="padding:12px 16px;background:#222240;border-radius:8px 8px 0 0;text-align:right;color:#fff;font-weight:700;font-size:18px;">{credits}</td>
  </tr>
  <tr>
    <td style="padding:12px 16px;background:#1e1e38;border-radius:0 0 8px 8px;color:{_MUTED};font-size:13px;">Amount Paid</td>
    <td style="padding:12px 16px;background:#1e1e38;border-radius:0 0 8px 8px;text-align:right;color:#fff;font-weight:700;font-size:18px;">{amount_usd}</td>
  </tr>
</table>
<p>Your updated balance is reflected on your dashboard.</p>
{_button(dashboard_url, "View Credit Balance →")}"""

        return await self._send(
            to_email,
            f"Payment Confirmed — {credits} Credits Added",
            _base_html("Payment Confirmed", body),
        )

    async def send_password_reset(self, to_email: str, reset_link: str) -> bool:
        """
        Password reset link email.
        """
        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">Reset Your Password 🔐</h2>
<p>We received a request to reset your Skillmate AI password.
   Click the button below to choose a new one:</p>
{_button(reset_link, "Reset Password →")}
<p style="color:{_MUTED};font-size:13px;">
  This link expires in <strong>1 hour</strong>.<br>
  If you didn't request a password reset, no action is needed — your account is safe.
</p>"""

        return await self._send(to_email, "Reset Your Skillmate AI Password", _base_html("Password Reset", body))

    async def send_recruiter_match(
        self,
        to_email: str,
        candidate_name: str,
        job_title: str,
        score: int,
    ) -> bool:
        """
        Notifies a recruiter when a strong candidate match is found.
        """
        recruiter_url = f"{settings.frontend_url}/recruiter/dashboard"

        # Dynamic badge colour
        if score >= 80:
            badge_bg, badge_label = "#00b894", "Strong Match"
        elif score >= 60:
            badge_bg, badge_label = "#fdcb6e", "Good Match"
        else:
            badge_bg, badge_label = "#e17055", "Partial Match"

        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">New Candidate Match 🎯</h2>
<p>A candidate scored high against one of your job openings:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr>
    <td style="padding:12px 16px;background:#222240;color:{_MUTED};font-size:13px;">Candidate</td>
    <td style="padding:12px 16px;background:#222240;text-align:right;color:#fff;font-weight:600;">{candidate_name}</td>
  </tr>
  <tr>
    <td style="padding:12px 16px;background:#1e1e38;color:{_MUTED};font-size:13px;">Job Title</td>
    <td style="padding:12px 16px;background:#1e1e38;text-align:right;color:#fff;font-weight:600;">{job_title}</td>
  </tr>
  <tr>
    <td style="padding:12px 16px;background:#222240;border-radius:0 0 8px 0;color:{_MUTED};font-size:13px;">Match Score</td>
    <td style="padding:12px 16px;background:#222240;border-radius:0 0 0 8px;text-align:right;">
      <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:14px;font-weight:700;color:#fff;background:{badge_bg};">
        {score}% — {badge_label}
      </span>
    </td>
  </tr>
</table>
{_button(recruiter_url, "View Candidate →")}"""

        return await self._send(
            to_email,
            f"🎯 Candidate Match: {candidate_name} ({score}%) for {job_title}",
            _base_html("Candidate Match", body),
        )

    async def send_credit_low(
        self,
        to_email: str,
        name: str,
        remaining: int,
    ) -> bool:
        """
        Sent when a user's credit balance drops below 5 after a tool use.
        """
        first_name = name.split()[0] if name else "there"
        credits_url = f"{settings.frontend_url}/dashboard/credits"

        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">Running Low on Credits ⚠️</h2>
<p>Hey {first_name}, you only have <strong style="color:#fdcb6e;">{remaining} credit{"s" if remaining != 1 else ""}</strong> left.</p>
<p>Credits power every AI tool on Skillmate — resume rewrites, ATS scans,
   interview coaching, and more. Top up now to keep your momentum going.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr>
    <td style="padding:16px;background:#2d2d4a;border-radius:8px;text-align:center;">
      <span style="font-size:36px;font-weight:700;color:#fdcb6e;">{remaining}</span><br>
      <span style="color:{_MUTED};font-size:13px;">credits remaining</span>
    </td>
  </tr>
</table>
{_button(credits_url, "Top Up Credits →")}
<p style="color:{_MUTED};font-size:13px;">
  Starter Pack (50 credits · $5) &nbsp;·&nbsp; Pro Pack (120 credits · $10) &nbsp;·&nbsp; Premium Pack (300 credits · $20)
</p>"""

        return await self._send(
            to_email,
            f"⚠️ Only {remaining} credit{'s' if remaining != 1 else ''} left — Top up now",
            _base_html("Low Credits", body),
        )

    async def send_career_roadmap_ready(
        self,
        to_email: str,
        name: str,
    ) -> bool:
        """
        Sent when the background career roadmap job completes.
        """
        first_name = name.split()[0] if name else "there"
        roadmap_url = f"{settings.frontend_url}/dashboard/roadmap"

        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">Your Career Roadmap is Ready 🗺️</h2>
<p>Hey {first_name}! Your personalised career roadmap has been generated and is waiting for you.</p>
<p>Inside your roadmap you'll find:</p>
<ul style="padding-left:20px;">
  <li>Step-by-step milestones tailored to your target role</li>
  <li>Curated learning resources for each stage</li>
  <li>Estimated timelines to keep you on track</li>
  <li>Skill gap analysis based on your current experience</li>
</ul>
{_button(roadmap_url, "View My Roadmap →")}
<p style="color:{_MUTED};font-size:13px;">
  Your roadmap is saved in your dashboard — you can revisit it anytime.
</p>"""

        return await self._send(
            to_email,
            "✦ Your Career Roadmap is Ready",
            _base_html("Career Roadmap Ready", body),
        )

    async def send_weekly_digest(
        self,
        to_email: str,
        name: str,
        stats: dict,
    ) -> bool:
        """
        Weekly digest email with the user's 7-day usage summary.

        stats dict keys (all optional — defaults to 0 if missing):
            tools_used      int   — total tool invocations
            credits_spent   int   — credits consumed
            credits_balance int   — current balance
            top_tool        str   — most-used tool name
            ats_scores      list  — list of recent ATS scores (int)
        """
        first_name = name.split()[0] if name else "there"
        dashboard_url = f"{settings.frontend_url}/dashboard"

        tools_used      = stats.get("tools_used", 0)
        credits_spent   = stats.get("credits_spent", 0)
        credits_balance = stats.get("credits_balance", 0)
        top_tool        = stats.get("top_tool", "—")
        ats_scores      = stats.get("ats_scores", [])

        # Build ATS score badge row if scores exist
        ats_row = ""
        if ats_scores:
            avg_score = round(sum(ats_scores) / len(ats_scores))
            color = "#00b894" if avg_score >= 70 else "#fdcb6e" if avg_score >= 50 else "#e17055"
            ats_row = f"""
  <tr>
    <td style="padding:10px 16px;background:#1e1e38;color:{_MUTED};font-size:13px;">Avg ATS Score</td>
    <td style="padding:10px 16px;background:#1e1e38;text-align:right;">
      <span style="color:{color};font-weight:700;">{avg_score}%</span>
    </td>
  </tr>"""

        body = f"""\
<h2 style="margin:0 0 16px;color:#fff;font-size:22px;">Your Weekly Recap 📊</h2>
<p>Hey {first_name}, here's what you accomplished on Skillmate AI this week:</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;">
  <tr>
    <td style="padding:10px 16px;background:#222240;border-radius:8px 8px 0 0;color:{_MUTED};font-size:13px;">Tools Used</td>
    <td style="padding:10px 16px;background:#222240;border-radius:8px 8px 0 0;text-align:right;color:#fff;font-weight:700;">{tools_used}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px;background:#1e1e38;color:{_MUTED};font-size:13px;">Credits Spent</td>
    <td style="padding:10px 16px;background:#1e1e38;text-align:right;color:#fff;font-weight:700;">{credits_spent}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px;background:#222240;color:{_MUTED};font-size:13px;">Credits Remaining</td>
    <td style="padding:10px 16px;background:#222240;text-align:right;color:#fff;font-weight:700;">{credits_balance}</td>
  </tr>
  <tr>
    <td style="padding:10px 16px;background:#1e1e38;color:{_MUTED};font-size:13px;">Most Used Tool</td>
    <td style="padding:10px 16px;background:#1e1e38;text-align:right;color:#fff;font-weight:600;">{top_tool}</td>
  </tr>{ats_row}
</table>
{"<p>🔥 Great work — you're building momentum! Keep going.</p>" if tools_used >= 5 else "<p>💡 <strong>Tip:</strong> Try the ATS Scanner this week — it only takes 30 seconds to check your resume.</p>"}
{_button(dashboard_url, "Open Dashboard →")}
<p style="color:{_MUTED};font-size:13px;">
  You receive this digest every Monday. We'll never send more than one per week.<br>
  <a href="{settings.frontend_url}/settings/notifications" style="color:{_MUTED};">Manage notification preferences</a>
</p>"""

        return await self._send(
            to_email,
            "✦ Your Skillmate AI Weekly Recap",
            _base_html("Weekly Digest", body),
        )


# Singleton — import this everywhere
email_service = EmailService()
