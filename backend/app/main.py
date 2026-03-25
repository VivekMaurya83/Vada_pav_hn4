"""
FastAPI backend for the Web Application Accessibility Audit Platform.

Endpoints:
    POST /api/scan        — Scan a URL for WCAG violations using Playwright + axe-core
    POST /api/remediate   — Get AI-corrected HTML from Featherless.ai
    GET  /api/rules       — Return the full WCAG 2.2 dictionary
"""

import json
import re
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from playwright.async_api import async_playwright

from app.config import (
    AXE_CDN_URL,
    GROQ_API_KEY,
    GROQ_API_URL,
    GROQ_MODEL,
    PAGE_TIMEOUT_MS,
    WCAG_DICTIONARY_PATH,
)

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from schemas import (
    ScanRequest,
    ScanResponse,
    IssueDetail,
    RemediateRequest,
    RemediateResponse,
)

logger = logging.getLogger("accessibility-audit")

# ─── In-memory stores populated at startup ───────────────────────
wcag_rules_by_id: dict[str, dict] = {}        # rule_id  → full rule object
axe_tag_to_rule_id: dict[str, str] = {}        # wcag111  → wcag_1_1_1
wcag_full_data: dict = {}                      # raw JSON for GET /api/rules

# Direct mapping from axe-core rule IDs to our WCAG rule_ids.
# This covers rules axe tags as "best-practice" or with ambiguous tags.
AXE_RULE_TO_WCAG: dict[str, str] = {
    # 1.1.1 Non-text Content
    "image-alt": "wcag_1_1_1",
    "input-image-alt": "wcag_1_1_1",
    "area-alt": "wcag_1_1_1",
    "object-alt": "wcag_1_1_1",
    "svg-img-alt": "wcag_1_1_1",
    "role-img-alt": "wcag_1_1_1",
    # 1.2.2 Captions
    "video-caption": "wcag_1_2_2",
    # 1.2.5 Audio Description
    "video-description": "wcag_1_2_5",
    # 1.3.1 Info and Relationships
    "heading-order": "wcag_1_3_1",
    "landmark-one-main": "wcag_1_3_1",
    "landmark-no-duplicate-main": "wcag_1_3_1",
    "landmark-no-duplicate-banner": "wcag_1_3_1",
    "landmark-no-duplicate-contentinfo": "wcag_1_3_1",
    "landmark-unique": "wcag_1_3_1",
    "landmark-banner-is-top-level": "wcag_1_3_1",
    "landmark-contentinfo-is-top-level": "wcag_1_3_1",
    "landmark-main-is-top-level": "wcag_1_3_1",
    "landmark-complementary-is-top-level": "wcag_1_3_1",
    "definition-list": "wcag_1_3_1",
    "dlitem": "wcag_1_3_1",
    "list": "wcag_1_3_1",
    "listitem": "wcag_1_3_1",
    "th-has-data-cells": "wcag_1_3_1",
    "td-headers-attr": "wcag_1_3_1",
    "td-has-header": "wcag_1_3_1",
    "table-fake-caption": "wcag_1_3_1",
    "scope-attr-valid": "wcag_1_3_1",
    "p-as-heading": "wcag_1_3_1",
    "form-field-multiple-labels": "wcag_1_3_1",
    "aria-allowed-attr": "wcag_1_3_1",
    "aria-required-attr": "wcag_1_3_1",
    "aria-valid-attr": "wcag_1_3_1",
    "aria-valid-attr-value": "wcag_1_3_1",
    "aria-required-children": "wcag_1_3_1",
    "aria-required-parent": "wcag_1_3_1",
    "empty-heading": "wcag_1_3_1",
    "region": "wcag_1_3_1",
    # 1.3.5 Identify Input Purpose
    "autocomplete-valid": "wcag_1_3_5",
    # 1.4.1 Use of Color
    "link-in-text-block": "wcag_1_4_1",
    # 1.4.3 Contrast Minimum
    "color-contrast": "wcag_1_4_3",
    # 1.4.4 Resize Text
    "meta-viewport": "wcag_1_4_4",
    "meta-viewport-large": "wcag_1_4_4",
    # 1.4.12 Text Spacing
    "avoid-inline-spacing": "wcag_1_4_12",
    # 2.1.1 Keyboard
    "scrollable-region-focusable": "wcag_2_1_1",
    "server-side-image-map": "wcag_2_1_1",
    # 2.2.1 Timing Adjustable
    "meta-refresh": "wcag_2_2_1",
    # 2.2.2 Pause, Stop, Hide
    "blink": "wcag_2_2_2",
    "marquee": "wcag_2_2_2",
    # 2.4.1 Bypass Blocks
    "bypass": "wcag_2_4_1",
    "skip-link": "wcag_2_4_1",
    # 2.4.2 Page Titled
    "document-title": "wcag_2_4_2",
    # 2.4.4 Link Purpose
    "link-name": "wcag_2_4_4",
    # 2.4.6 Headings and Labels
    "empty-table-header": "wcag_2_4_6",
    # 2.5.3 Label in Name
    "label-content-name-mismatch": "wcag_2_5_3",
    # 3.1.1 Language of Page
    "html-has-lang": "wcag_3_1_1",
    "html-lang-valid": "wcag_3_1_1",
    "html-xml-lang-mismatch": "wcag_3_1_1",
    # 3.1.2 Language of Parts
    "valid-lang": "wcag_3_1_2",
    # 3.2.2 On Input
    "select-name": "wcag_3_2_2",
    # 3.3.1 Error Identification
    "aria-input-field-name": "wcag_3_3_1",
    # 3.3.2 Labels or Instructions
    "label": "wcag_3_3_2",
    "input-button-name": "wcag_3_3_2",
    # 4.1.1 Parsing
    "duplicate-id-active": "wcag_4_1_1",
    "duplicate-id-aria": "wcag_4_1_1",
    "duplicate-id": "wcag_4_1_1",
    # 4.1.2 Name, Role, Value
    "aria-hidden-body": "wcag_4_1_2",
    "aria-hidden-focus": "wcag_4_1_2",
    "button-name": "wcag_4_1_2",
    "frame-title": "wcag_4_1_2",
    "frame-title-unique": "wcag_4_1_2",
    "aria-roles": "wcag_4_1_2",
    "tabindex": "wcag_4_1_2",
}


def _build_axe_tag_mapping() -> None:
    """
    Build a reverse map from axe-core tag format to our rule_id.
    axe-core tags look like "wcag111", "wcag143", "wcag2aa", etc.
    Our rule_ids look like   "wcag_1_1_1", "wcag_1_4_3".
    We generate all plausible axe-tag forms for each rule_id.
    """
    for rule_id, rule_obj in wcag_rules_by_id.items():
        # rule_id = "wcag_1_1_1" → parts = ["1", "1", "1"]
        parts = rule_id.replace("wcag_", "").split("_")
        axe_tag = "wcag" + "".join(parts)            # "wcag111"
        axe_tag_to_rule_id[axe_tag] = rule_id

        # Also store the criterion number with dots for direct matching
        criterion_num = ".".join(parts)               # "1.1.1"
        axe_tag_to_rule_id[criterion_num] = rule_id


def _load_wcag_dictionary() -> None:
    """Load the WCAG dictionary JSON into memory."""
    global wcag_full_data
    try:
        with open(WCAG_DICTIONARY_PATH, "r", encoding="utf-8") as f:
            wcag_full_data = json.load(f)
        for rule in wcag_full_data.get("wcag_dictionary", []):
            rid = rule.get("rule_id", "")
            if rid:
                wcag_rules_by_id[rid] = rule
        _build_axe_tag_mapping()
        logger.info(
            "WCAG dictionary loaded: %d rules, %d axe-tag mappings",
            len(wcag_rules_by_id),
            len(axe_tag_to_rule_id),
        )
    except FileNotFoundError:
        logger.error("WCAG dictionary not found at %s", WCAG_DICTIONARY_PATH)
        raise
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON in WCAG dictionary: %s", exc)
        raise


# ─── Lifespan ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_wcag_dictionary()
    yield


# ─── App ──────────────────────────────────────────────────────────
app = FastAPI(
    title="Accessibility Audit API",
    description="Scan web pages for WCAG 2.2 violations and get AI-powered HTML remediation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ───────────────────────────────────────────────────────────────────
#  Helpers
# ───────────────────────────────────────────────────────────────────

def _resolve_rule_id(axe_rule_id: str, tags: list[str]) -> str:
    """
    Resolve a WCAG rule_id from axe-core data.
    Priority: 1) wcag-specific tags  2) direct axe rule ID map  3) best-practice / unmapped
    """
    # 1) Try to match from wcag tags (e.g. wcag111 → wcag_1_1_1)
    for tag in tags:
        tag_lower = tag.lower()
        if tag_lower in axe_tag_to_rule_id:
            return axe_tag_to_rule_id[tag_lower]

    # 2) Fallback: direct axe rule ID → WCAG mapping
    if axe_rule_id in AXE_RULE_TO_WCAG:
        return AXE_RULE_TO_WCAG[axe_rule_id]

    # 3) Mark best-practice separately from truly unmapped
    if "best-practice" in tags:
        return "best-practice"

    return "unmapped"


def _compute_score(total_issues: int) -> int:
    """Score = 100 − (5 × issues), clamped to [0, 100]."""
    return max(0, 100 - total_issues * 5)


# ───────────────────────────────────────────────────────────────────
#  POST /api/scan
# ───────────────────────────────────────────────────────────────────

@app.post("/api/scan", response_model=ScanResponse)
async def scan_url(payload: ScanRequest):
    """
    Scan a web page for WCAG accessibility violations using Playwright + axe-core.
    """
    target_url = str(payload.url)

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                await page.goto(target_url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
            except Exception as nav_err:
                await browser.close()
                raise HTTPException(
                    status_code=422,
                    detail=f"Failed to navigate to {target_url}: {nav_err}",
                )

            # Inject axe-core
            try:
                await page.add_script_tag(url=AXE_CDN_URL)
                await page.wait_for_function("typeof axe !== 'undefined'", timeout=15000)
            except Exception:
                # Fallback: inject axe-core via evaluate if CDN is blocked
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(AXE_CDN_URL, timeout=15)
                        resp.raise_for_status()
                        await page.evaluate(resp.text)
                except Exception as axe_err:
                    await browser.close()
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to inject axe-core: {axe_err}",
                    )

            # Run axe analysis — ALWAYS run this if injection succeeded
            try:
                axe_results = await page.evaluate(
                    "axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa', 'best-practice', 'cat.color'] } }).then(r => r)"
                )
            except Exception as run_err:
                await browser.close()
                raise HTTPException(
                    status_code=500,
                    detail=f"axe-core analysis failed: {run_err}",
                )

            await browser.close()

    except HTTPException:
        raise
    except Exception as pw_err:
        raise HTTPException(
            status_code=500,
            detail=f"Playwright error: {pw_err}",
        )

    # Parse results: include both violations (definite issues) and incomplete (needs review)
    violations = axe_results.get("violations", [])
    incomplete = axe_results.get("incomplete", [])
    issues: list[IssueDetail] = []

    def _clean_failure_summary(summary: str) -> str:
        """Removes repetitive technical prefixes from axe-core summaries."""
        if not summary: return ""
        # Remove common prefixes
        prefixes = [
            "Fix any of the following:",
            "Fix all of the following:",
            "Fix the following:",
        ]
        cleaned = summary.strip()
        for p in prefixes:
            if cleaned.startswith(p):
                cleaned = cleaned[len(p):].strip()
        
        # Humanize common technical terms
        replacements = {
            "is not contained by landmarks": "is floating outside of a proper page area (like main, header, or footer)",
            "does not have a main landmark": "is missing a designated 'main' content area (essential for screen reader navigation)",
            "should have one main landmark": "is missing a designated 'main' content area (essential for screen reader navigation)",
            "does not have a lang attribute": "is missing a language tag (needed for correct screen reader pronunciation)",
            "is not visible": "is hidden from view (which can confuse screen readers if not marked correctly)",
            "sufficient color contrast": "readable color contrast (the text is too hard to see against its background)",
            "must have alternate text": "have a text description (needed for users who can't see images)",
            "id attribute value must be unique": "have a unique ID (duplicate IDs confuse accessibility tools and forms)",
            "Form elements must have labels": "Each form field needs a clear text label so users know what to type",
            "Buttons must have discernible text": "Buttons need clear text or an aria-label so screen readers know what they do",
            "Links must have discernible text": "Links need descriptive text so users know where they lead",
        }
        for old, new in replacements.items():
            if old in cleaned:
                cleaned = cleaned.replace(old, new)
                
        return cleaned

    def _process_axe_items(items: list, is_incomplete: bool):
        for item in items:
            axe_rule_id = item.get("id", "unknown")
            tags = item.get("tags", [])
            axe_impact = item.get("impact", "unknown")
            axe_description = item.get("description", "")
            help_url = item.get("helpUrl", "")

            rule_id = _resolve_rule_id(axe_rule_id, tags)
            wcag_rule = wcag_rules_by_id.get(rule_id, {})

            # ── Prioritize JSON dictionary data over axe-core ──
            json_impact_raw = wcag_rule.get("impact", "")
            impact = axe_impact
            if json_impact_raw:
                impact_lower = json_impact_raw.lower()
                if "critical" in impact_lower: impact = "critical"
                elif "serious" in impact_lower: impact = "serious"
                elif "moderate" in impact_lower: impact = "moderate"
                elif "minor" in impact_lower: impact = "minor"

            # Description: help text is generally more readable
            axe_help = item.get("help", "")
            description = axe_help if axe_help else (axe_description or wcag_rule.get("description", "Accessibility Issue"))

            # Create individual issues for each affected node
            for node in item.get("nodes", []):
                html_snippet = node.get("html", "")
                css_selector = ", ".join(node.get("target", []))
                issues.append(
                    IssueDetail(
                        rule_id=rule_id,
                        axe_rule_id=axe_rule_id,
                        impact=impact,
                        description=description,
                        failure_summary=_clean_failure_summary(node.get("failureSummary", "")),
                        help_url=help_url,
                        wcag_criterion=wcag_rule.get("success_criterion", ""),
                        html_snippet=html_snippet,
                        css_selector=css_selector,
                        conformance_level=wcag_rule.get("conformance_level", ""),
                        principle=wcag_rule.get("principle", ""),
                        featherless_prompt_context=wcag_rule.get("featherless_prompt_context", ""),
                        impact_description=wcag_rule.get("impact", ""),
                        common_failures=wcag_rule.get("common_failures", []),
                        affected_users=wcag_rule.get("affected_users", []),
                        test_procedure=wcag_rule.get("test_procedure", ""),
                        is_incomplete=is_incomplete,
                    )
                )

    _process_axe_items(violations, is_incomplete=False)
    _process_axe_items(incomplete, is_incomplete=True)


    return ScanResponse(
        url=target_url,
        score=_compute_score(len(issues)),
        total_issues=len(issues),
        issues=issues,
        scanned_at=datetime.now(timezone.utc).isoformat(),
    )


# ───────────────────────────────────────────────────────────────────
async def _fetch_ai_fix(rule_id: str, broken_html: str) -> str | None:
    """Helper to fetch AI remediation for a single issue. Returns None on failure."""
    if not GROQ_API_KEY:
        return None

    wcag_rule = wcag_rules_by_id.get(rule_id)
    if not wcag_rule:
        return None

    prompt_context = wcag_rule.get("featherless_prompt_context", "")
    if not prompt_context:
        return None

    system_prompt = (
        "You are an expert web accessibility remediation assistant. "
        "You ONLY output raw, corrected HTML code for a SINGLE element tag. "
        "Do NOT include markdown formatting, code fences, explanations, or conversational text. "
        "STRICT RULE 1: ONLY add or correct accessibility attributes (like alt, aria-label, role, aria-describedby, etc.). "
        "STRICT RULE 2: NEVER add new child elements, text content, or change the tag type. "
        "STRICT RULE 3: Preserve ALL existing non-accessibility attributes (like class, id, style) exactly as they are. "
        "Return ONLY the fixed starting tag snippet."
    )
    user_prompt = (
        f"WCAG Rule context: {prompt_context}\n\n"
        f"Original Element Snippet:\n{broken_html}\n\n"
        "FIX THE ATTRIBUTES ONLY. Do not add any new content inside the tag. "
        "Ensure the fix is valid HTML and directly addresses the accessibility failure. "
        "Return ONLY the corrected HTML tag."
    )

    request_body = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 4096,
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
            corrected = data["choices"][0]["message"]["content"].strip()
            corrected = re.sub(r"^```(?:html)?\s*\n?", "", corrected)
            corrected = re.sub(r"\n?```\s*$", "", corrected)
            return corrected.strip()
    except httpx.HTTPStatusError as e:
        error_body = e.response.text
        logger.error(f"Groq HTTP Error {e.response.status_code}: {error_body}")
        raise HTTPException(status_code=502, detail=f"AI Provider Error ({e.response.status_code}): {error_body}")
    except Exception as e:
        logger.error(f"AI Remediation failed for {rule_id}: {e}")
        raise HTTPException(status_code=500, detail=f"AI Remediation Exception: {str(e)}")

# ───────────────────────────────────────────────────────────────────
#  POST /api/remediate
# ───────────────────────────────────────────────────────────────────

@app.post("/api/remediate", response_model=RemediateResponse)
async def remediate_html(payload: RemediateRequest):
    """
    Use Featherless.ai LLM to generate a corrected HTML snippet
    that satisfies the specified WCAG rule.
    """
    rule_id = payload.rule_id
    broken_html = payload.broken_html

    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured.")

    corrected_html = await _fetch_ai_fix(rule_id, broken_html)
    
    if corrected_html is None:
        raise HTTPException(status_code=500, detail=f"Failed to generate fix for rule {rule_id}")

    return RemediateResponse(
        corrected_html=corrected_html,
        rule_id=rule_id,
        model_used=GROQ_MODEL,
    )


# ───────────────────────────────────────────────────────────────────
#  GET /api/rules
# ───────────────────────────────────────────────────────────────────

@app.get("/api/rules")
async def get_rules():
    """Return the complete WCAG 2.2 dictionary."""
    return wcag_full_data

# ───────────────────────────────────────────────────────────────────
#  POST /api/report/pdf
# ───────────────────────────────────────────────────────────────────

@app.post("/api/report/pdf")
async def generate_pdf(payload: ScanResponse):
    """Generate a PDF report from the scan results using Playwright."""
    def escape_html(text: str) -> str:
        if not text:
            return ""
        return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    html_parts = [
        "<!DOCTYPE html>",
        "<html><head><style>",
        "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 20px; }",
        "h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 0; }",
        ".meta-info { margin-bottom: 30px; padding: 15px; background: #ecf0f1; border-radius: 8px; }",
        ".meta-info p { margin: 5px 0; font-weight: 500; font-size: 14px; }",
        ".issue-card { border: 1px solid #ddd; border-left: 4px solid #95a5a6; padding: 15px; margin-bottom: 20px; border-radius: 4px; page-break-inside: avoid; }",
        ".issue-card.critical { border-left-color: #e74c3c; }",
        ".issue-card.serious { border-left-color: #e67e22; }",
        ".issue-card.moderate { border-left-color: #f1c40f; }",
        ".issue-card.minor { border-left-color: #2ecc71; }",
        ".issue-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #2c3e50; text-transform: capitalize; }",
        ".badge { display: inline-block; padding: 3px 8px; font-size: 11px; border-radius: 12px; background: #eee; margin-right: 5px; font-weight: bold; color: #555; border: 1px solid #ddd; }",
        ".snippet { background: #f8f9fa; padding: 10px; font-family: 'Courier New', Courier, monospace; font-size: 11px; overflow-x: auto; border: 1px solid #ddd; border-radius: 4px; margin-top: 10px; word-wrap: break-word; white-space: pre-wrap; }",
        ".why-it-matters { background: #e8f4fd; padding: 10px; border-left: 3px solid #3498db; margin: 10px 0; font-size: 13px; }",
        ".desc { font-size: 14px; margin-bottom: 10px; }",
        "</style></head><body>",
        f"<h1>AccessiScan Audit Report</h1>",
        f"<div class='meta-info'>",
        f"<p><strong>URL Scanned:</strong> <a href='{escape_html(payload.url)}'>{escape_html(payload.url)}</a></p>",
        f"<p><strong>Accessibility Score:</strong> {payload.score} / 100</p>",
        f"<p><strong>Total Issues Found:</strong> {payload.total_issues}</p>",
        f"<p><strong>Date Scanned:</strong> {escape_html(payload.scanned_at)}</p>",
        f"</div>",
        "<h2>Issues Breakdown</h2>"
    ]

    if not payload.issues:
        html_parts.append("<p>No accessibility issues found. Excellent job!</p>")
    else:
        # Pre-fetch AI fixes concurrently (max 5 at a time)
        sem = asyncio.Semaphore(5)
        
        async def fetch_fix_with_sem(issue):
            if not issue.html_snippet or issue.rule_id in ["best-practice", "unmapped"]:
                return None
            async with sem:
                return await _fetch_ai_fix(issue.rule_id, issue.html_snippet)

        fixes = await asyncio.gather(*(fetch_fix_with_sem(issue) for issue in payload.issues))

        for idx, (issue, fix) in enumerate(zip(payload.issues, fixes), start=1):
            impact_class = issue.impact.lower()
            html_parts.append(f"<div class='issue-card {impact_class}'>")
            
            rule_label = issue.rule_id.replace("wcag_", "WCAG ").replace("_", ".")
            if "best-practice" in issue.rule_id: rule_label = "Best Practice"
            if "unmapped" in issue.rule_id: rule_label = "Unmapped Rule"
            
            html_parts.append(f"<div class='issue-title'>{idx}. {escape_html(rule_label)} — {escape_html(issue.impact)}</div>")
            
            html_parts.append("<div style='margin-bottom: 10px;'>")
            if issue.wcag_criterion:
                html_parts.append(f"<span class='badge'>{escape_html(issue.wcag_criterion)}</span>")
            if issue.conformance_level:
                html_parts.append(f"<span class='badge'>Level {escape_html(issue.conformance_level)}</span>")
            html_parts.append("</div>")
                
            html_parts.append(f"<div class='desc'><strong>Issue:</strong> {escape_html(issue.description)}</div>")
            
            if issue.impact_description:
                html_parts.append(f"<div class='why-it-matters'><strong>Why it matters:</strong> {escape_html(issue.impact_description)}</div>")
                
            if issue.html_snippet:
                html_parts.append(f"<p style='margin-bottom: 5px; font-weight: 500; font-size: 13px;'>Original HTML:</p>")
                html_parts.append(f"<div class='snippet' style='color: #c0392b;'>{escape_html(issue.html_snippet)}</div>")
                
            if fix:
                html_parts.append(f"<p style='margin-bottom: 5px; margin-top: 15px; font-weight: 500; font-size: 13px;'>✅ AI-Suggested Fix:</p>")
                html_parts.append(f"<div class='snippet' style='color: #27ae60; background: #eafaf1; border-color: #2ecc71;'>{escape_html(fix)}</div>")
                
            html_parts.append("</div>")

    html_parts.append("</body></html>")
    full_html = "\\n".join(html_parts)

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_content(full_html)
            pdf_bytes = await page.pdf(
                format="A4",
                margin={"top": "20px", "right": "20px", "bottom": "20px", "left": "20px"},
                print_background=True,
            )
            await browser.close()
            
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=AccessiScan-Report.pdf"}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")
