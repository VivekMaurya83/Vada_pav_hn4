import sys, os
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import json
import re
import logging
import traceback
import random
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
                # Use 'commit' to avoid hanging on network-heavy sites, then wait for body
                await page.goto(target_url, wait_until="commit", timeout=PAGE_TIMEOUT_MS)
                await page.wait_for_selector("body", timeout=PAGE_TIMEOUT_MS)
            except Exception as nav_err:
                await browser.close()
                raise HTTPException(
                    status_code=422,
                    detail=f"Failed to navigate to {target_url}: {nav_err}",
                )

            # Inject axe-core
            try:
                # 1) Try CDN
                await page.add_script_tag(url=AXE_CDN_URL)
                await page.wait_for_function("typeof axe !== 'undefined'", timeout=10000)
            except Exception:
                # 2) Try Local File
                try:
                    local_axe = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "axe.min.js")
                    if os.path.exists(local_axe):
                        await page.add_script_tag(path=local_axe)
                        await page.wait_for_function("typeof axe !== 'undefined'", timeout=10000)
                    else:
                        raise FileNotFoundError(f"Local axe.min.js not found at {local_axe}")
                except Exception as local_err:
                    # 3) Fallback: inject via evaluate (last resort)
                    try:
                        async with httpx.AsyncClient() as client:
                            resp = await client.get(AXE_CDN_URL, timeout=15)
                            resp.raise_for_status()
                            await page.evaluate(resp.text)
                            await page.wait_for_function("typeof axe !== 'undefined'", timeout=10000)
                    except Exception as axe_err:
                        await browser.close()
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to inject axe-core (CDN, local, and fetch failed). Last error: {axe_err}",
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
        tb = traceback.format_exc()
        logger.error(f"Playwright error: {pw_err}\n{tb}")
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

    max_retries = 3
    base_delay = 1.0  # seconds

    for attempt in range(max_retries):
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
                
                # Handle Rate Limit (429)
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        # Successive retries use exponential backoff + jitter
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        logger.warning(f"Groq Rate Limit (429). Retrying in {delay:.2f}s... (Attempt {attempt+1}/{max_retries})")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        error_body = response.text
                        logger.error(f"Groq Rate Limit exceeded after {max_retries} retries: {error_body}")
                        raise HTTPException(status_code=429, detail="AI Provider Rate Limit exceeded. Please try again later.")

                response.raise_for_status()
                data = response.json()
                corrected = data["choices"][0]["message"]["content"].strip()
                corrected = re.sub(r"^```(?:html)?\s*\n?", "", corrected)
                corrected = re.sub(r"\n?```\s*$", "", corrected)
                return corrected.strip()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                # This should be handled by the check above, but as a safety:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    await asyncio.sleep(delay)
                    continue
            
            error_body = e.response.text
            logger.error(f"Groq HTTP Error {e.response.status_code}: {error_body}")
            raise HTTPException(status_code=502, detail=f"AI Provider Error ({e.response.status_code}): {error_body}")
        except Exception as e:
            logger.error(f"AI Remediation attempt {attempt+1} failed for {rule_id}: {e}")
            if attempt == max_retries - 1:
                raise HTTPException(status_code=500, detail=f"AI Remediation Exception: {str(e)}")
            await asyncio.sleep(base_delay * (attempt + 1))

    return None

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
#  Batch AI fix for PDF (single API call)
# ───────────────────────────────────────────────────────────────────

async def _batch_ai_fixes(issues: list) -> dict[int, str]:
    """
    Make Groq API calls to get fixes for all issues.
    Chunks requests to avoid token limits per call.
    Returns a dict mapping issue index → corrected HTML string.
    """
    if not GROQ_API_KEY:
        return {}

    # Filter fixable issues (need snippet)
    fixable = []
    for idx, issue in enumerate(issues):
        if issue.html_snippet:
            ctx = ""
            if issue.rule_id not in ["best-practice", "unmapped"] and wcag_rules_by_id.get(issue.rule_id):
                ctx = wcag_rules_by_id[issue.rule_id].get("featherless_prompt_context", "")
            fixable.append((idx, issue, ctx))

    if not fixable:
        return {}

    # Chunk the fixable issues (e.g., 10 per request) to stay within limits
    CHUNK_SIZE = 10
    chunks = [fixable[i:i + CHUNK_SIZE] for i in range(0, len(fixable), CHUNK_SIZE)]
    
    # Process sequentially to avoid hitting the 6,000 TPM limit on free tiers
    sem = asyncio.Semaphore(1)

    async def process_chunk(chunk) -> dict[int, str]:
        issue_lines = []
        for i, (idx, issue, ctx) in enumerate(chunk, 1):
            rule_info = ctx or f"{issue.description}. Specific error: {issue.failure_summary}"
            issue_lines.append(
                f"[ISSUE {i}]\n"
                f"Rule/Error: {rule_info}\n"
                f"HTML: {issue.html_snippet}\n"
            )

        issues_block = "\n".join(issue_lines)

        system_prompt = (
            "You are an expert web accessibility remediation assistant. "
            "You will receive multiple numbered accessibility issues. "
            "For each issue, output ONLY the corrected HTML tag. "
            "Format your response as:\n"
            "[FIX 1]\n<corrected html>\n"
            "[FIX 2]\n<corrected html>\n"
            "...and so on.\n"
            "Rules: Only add/correct accessibility attributes (alt, aria-label, role, etc). "
            "Never add new child elements or change the tag type. "
            "Preserve all existing attributes. No explanations, no markdown."
        )

        user_prompt = f"Fix each issue below:\n\n{issues_block}"

        request_body = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 4096,
            "temperature": 0.2,
        }

        async with sem:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    for attempt in range(3):
                        response = await client.post(
                            GROQ_API_URL,
                            headers={
                                "Authorization": f"Bearer {GROQ_API_KEY}",
                                "Content-Type": "application/json",
                            },
                            json=request_body,
                        )
                        if response.status_code == 429:
                            # 429 errors on Groq are often TPM (Tokens Per Minute) limits.
                            # We need to wait a significant chunk of time for the window to slide.
                            delay = 10 * (attempt + 1) + random.uniform(1.0, 3.0)
                            logger.warning(f"Batch AI Chunk: rate limited, retrying in {delay:.1f}s")
                            await asyncio.sleep(delay)
                            continue
                        response.raise_for_status()
                        break
                    else:
                        logger.warning("Batch AI Chunk: exhausted retries")
                        return {}

                raw = response.json()["choices"][0]["message"]["content"].strip()

                # Parse [FIX N] blocks
                chunk_fixes: dict[int, str] = {}
                parts = re.split(r"\[FIX\s+(\d+)\]", raw)
                for i in range(1, len(parts) - 1, 2):
                    fix_num = int(parts[i])
                    fix_html = parts[i + 1].strip()
                    
                    # Clean up per-fix markdown if the AI mistakenly added it
                    fix_html = re.sub(r"^```(?:html)?\s*\n?", "", fix_html)
                    fix_html = re.sub(r"\n?```\s*$", "", fix_html)
                    fix_html = fix_html.strip()

                    if fix_html and 1 <= fix_num <= len(chunk):
                        original_idx = chunk[fix_num - 1][0]
                        chunk_fixes[original_idx] = fix_html

                return chunk_fixes

            except Exception as e:
                logger.warning(f"Batch AI Chunk failed (non-fatal): {e}")
                return {}

    # Process all chunks concurrently and merge results
    results = await asyncio.gather(*(process_chunk(chunk) for chunk in chunks))
    
    all_fixes = {}
    for res in results:
        all_fixes.update(res)

    logger.info(f"Batch AI: got {len(all_fixes)} fixes from {len(chunks)} chunks")
    return all_fixes


# ───────────────────────────────────────────────────────────────────
#  POST /api/report/pdf
# ───────────────────────────────────────────────────────────────────

@app.post("/api/report/pdf")
async def generate_pdf(payload: ScanResponse):
    """Generate a professionally formatted PDF accessibility report."""

    def esc(text: str) -> str:
        if not text:
            return ""
        return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # ── Batch AI fixes (single API call) ──
    ai_fixes: dict[int, str] = {}
    fixable_issues = [
        i for i in payload.issues
        if i.html_snippet and i.rule_id not in ["best-practice", "unmapped"]
    ]
    if fixable_issues and GROQ_API_KEY:
        try:
            ai_fixes = await _batch_ai_fixes(payload.issues)
        except Exception as e:
            logger.warning(f"Batch AI skipped: {e}")

    # ── Impact counts for summary ──
    impact_counts = {"critical": 0, "serious": 0, "moderate": 0, "minor": 0}
    for issue in payload.issues:
        imp = issue.impact.lower()
        if imp in impact_counts:
            impact_counts[imp] += 1

    # ── Score color ──
    score = payload.score
    if score >= 80:
        score_color, score_label = "#27ae60", "Good"
    elif score >= 50:
        score_color, score_label = "#f39c12", "Needs Work"
    else:
        score_color, score_label = "#e74c3c", "Poor"

    # ── Build HTML ──
    css = """
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #2c3e50; line-height: 1.6; padding: 40px; font-size: 13px; }

    /* Header */
    .report-header { text-align: center; margin-bottom: 35px; padding-bottom: 25px; border-bottom: 3px solid #3498db; }
    .report-header h1 { font-size: 28px; color: #2c3e50; margin-bottom: 4px; letter-spacing: -0.5px; }
    .report-header .subtitle { color: #7f8c8d; font-size: 13px; }

    /* Score */
    .score-section { display: flex; align-items: center; justify-content: center; gap: 30px; margin: 25px 0; padding: 25px; background: linear-gradient(135deg, #f8f9fa, #ecf0f1); border-radius: 12px; }
    .score-circle { width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; font-weight: bold; }
    .score-circle .number { font-size: 32px; line-height: 1; }
    .score-circle .label { font-size: 10px; text-transform: uppercase; opacity: 0.9; }
    .score-details { text-align: left; }
    .score-details p { margin: 3px 0; font-size: 13px; }

    /* Summary Table */
    .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0 30px; }
    .summary-table th, .summary-table td { padding: 10px 14px; text-align: left; border: 1px solid #ddd; font-size: 12px; }
    .summary-table th { background: #34495e; color: white; font-weight: 600; }
    .summary-table tr:nth-child(even) { background: #f8f9fa; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .dot-critical { background: #e74c3c; }
    .dot-serious { background: #e67e22; }
    .dot-moderate { background: #f1c40f; }
    .dot-minor { background: #27ae60; }

    /* Issues */
    h2 { font-size: 20px; color: #2c3e50; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #ecf0f1; }
    .issue-card { border: 1px solid #e0e0e0; border-left: 5px solid #95a5a6; padding: 18px; margin-bottom: 18px; border-radius: 6px; page-break-inside: avoid; background: #fff; }
    .issue-card.critical { border-left-color: #e74c3c; }
    .issue-card.serious { border-left-color: #e67e22; }
    .issue-card.moderate { border-left-color: #f1c40f; }
    .issue-card.minor { border-left-color: #27ae60; }

    .issue-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .issue-num { background: #34495e; color: white; border-radius: 50%; min-width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
    .issue-title { font-size: 15px; font-weight: 700; color: #2c3e50; }
    .impact-pill { padding: 2px 10px; border-radius: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: white; }
    .impact-critical { background: #e74c3c; }
    .impact-serious { background: #e67e22; }
    .impact-moderate { background: #f1c40f; color: #333; }
    .impact-minor { background: #27ae60; }

    .badge { display: inline-block; padding: 2px 8px; font-size: 10px; border-radius: 10px; background: #ecf0f1; margin-right: 4px; font-weight: 600; color: #555; }
    .issue-desc { font-size: 13px; margin: 8px 0; color: #444; }
    .info-box { padding: 10px 12px; border-radius: 4px; margin: 8px 0; font-size: 12px; }
    .info-error { background: #fdf0ed; border-left: 3px solid #e74c3c; color: #c0392b; }
    .info-why { background: #eaf4fd; border-left: 3px solid #3498db; color: #2471a3; }

    /* Code blocks */
    .code-label { font-size: 11px; font-weight: 700; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .code-label.broken { color: #e74c3c; }
    .code-label.fixed { color: #27ae60; }
    .code-block { font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace; font-size: 11px; padding: 10px 12px; border-radius: 4px; white-space: pre-wrap; word-break: break-all; line-height: 1.5; border: 1px solid #ddd; }
    .code-broken { background: #fef5f5; color: #c0392b; border-color: #f5c6cb; }
    .code-fixed { background: #f0faf0; color: #1e8449; border-color: #c3e6cb; }
    .code-guidance { background: #f0f7ff; color: #2c5282; border-color: #bee3f8; }

    /* Footer */
    .report-footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 2px solid #ecf0f1; font-size: 11px; color: #95a5a6; }
    """

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><style>{css}</style></head><body>

<div class="report-header">
  <h1>AccessiScan — Accessibility Audit Report</h1>
  <div class="subtitle">WCAG 2.2 Compliance Analysis • Generated by AccessiScan AI</div>
  <div style="margin-top: 15px; font-size: 13px; color: #555;">
    <strong>URL:</strong> {esc(payload.url)} &nbsp;|&nbsp; 
    <strong>Date:</strong> {esc(payload.scanned_at)} &nbsp;|&nbsp;
    <strong>Total Issues:</strong> {payload.total_issues}
  </div>
</div>

<h2>Impact Summary</h2>
<table class="summary-table">
  <tr>
    <th>Severity</th><th>Count</th><th>Description</th>
  </tr>
  <tr><td><span class="dot dot-critical"></span>Critical</td><td>{impact_counts['critical']}</td><td>Blocks access completely for some users</td></tr>
  <tr><td><span class="dot dot-serious"></span>Serious</td><td>{impact_counts['serious']}</td><td>Significantly hinders accessibility</td></tr>
  <tr><td><span class="dot dot-moderate"></span>Moderate</td><td>{impact_counts['moderate']}</td><td>Causes difficulty for some users</td></tr>
  <tr><td><span class="dot dot-minor"></span>Minor</td><td>{impact_counts['minor']}</td><td>Low-impact usability improvement</td></tr>
</table>

<h2>Detailed Issues ({payload.total_issues})</h2>
"""

    if not payload.issues:
        html += "<p style='color: #27ae60; font-size: 16px; text-align: center; padding: 30px;'>✅ No accessibility issues found. Excellent job!</p>"
    else:
        for idx, issue in enumerate(payload.issues):
            impact_class = issue.impact.lower()
            rule_label = issue.rule_id.replace("wcag_", "WCAG ").replace("_", ".")
            if "best-practice" in issue.rule_id:
                rule_label = "Best Practice"
            if "unmapped" in issue.rule_id:
                rule_label = "Unmapped Rule"

            # Badges
            badges = ""
            if issue.wcag_criterion:
                badges += f"<span class='badge'>{esc(issue.wcag_criterion)}</span>"
            if issue.conformance_level:
                badges += f"<span class='badge'>Level {esc(issue.conformance_level)}</span>"
            if issue.principle:
                badges += f"<span class='badge'>{esc(issue.principle)}</span>"

            # Info boxes
            error_box = ""
            if issue.failure_summary:
                error_box = f"<div class='info-box info-error'><strong>Error:</strong> {esc(issue.failure_summary)}</div>"
            why_box = ""
            if issue.impact_description:
                why_box = f"<div class='info-box info-why'><strong>Why it matters:</strong> {esc(issue.impact_description)}</div>"

            # Code blocks
            broken_code = ""
            if issue.html_snippet:
                broken_code = f"""<div class="code-label broken">❌ Affected HTML</div>
<div class="code-block code-broken">{esc(issue.html_snippet)}</div>"""

            # AI fix
            fix_code = ""
            if idx in ai_fixes:
                fix_code = f"""<div class="code-label fixed">✅ AI-Suggested Fix</div>
<div class="code-block code-fixed">{esc(ai_fixes[idx])}</div>"""

            # Common failures
            failures_html = ""
            wcag_rule = wcag_rules_by_id.get(issue.rule_id, {})
            failures = wcag_rule.get("common_failures", [])
            if failures:
                items = "".join(f"<li>{esc(f)}</li>" for f in failures[:4])
                failures_html = f"<div style='margin-top: 8px; font-size: 11px;'><strong>Common Failures:</strong><ul style='margin: 4px 0 0 16px;'>{items}</ul></div>"

            html += f"""
<div class="issue-card {impact_class}">
  <div class="issue-header">
    <span class="issue-num">{idx + 1}</span>
    <span class="issue-title">{esc(rule_label)}</span>
    <span class="impact-pill impact-{impact_class}">{esc(issue.impact)}</span>
  </div>
  <div style="margin-bottom: 8px;">{badges}</div>
  <div class="issue-desc">{esc(issue.description)}</div>
  {error_box}
  {why_box}
  {broken_code}
  {fix_code}
  {failures_html}
</div>
"""

    html += f"""
<div class="report-footer">
  Generated by <strong>AccessiScan AI</strong> — Web Application Accessibility Audit Platform<br>
  Report generated on {esc(payload.scanned_at)}
</div>
</body></html>"""

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_content(html, wait_until="networkidle")
            pdf_bytes = await page.pdf(
                format="A4",
                margin={"top": "30px", "right": "30px", "bottom": "40px", "left": "30px"},
                print_background=True,
            )
            await browser.close()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=AccessiScan-Report.pdf"},
        )
    except Exception as exc:
        logger.error(f"PDF generation failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")
