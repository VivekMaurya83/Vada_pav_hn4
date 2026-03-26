import sys
import os
import json
import base64
import httpx
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright
from .config import config
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# CRITICAL FIX for Playwright on Windows: NotImplementedError
# Playwright needs ProactorEventLoop to spawn subprocesses. 
# Uvicorn / other libs sometimes default to SelectorEventLoop.
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Build absolute path for firebase credentials
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

cred_path = os.path.join(base_dir, "firebase-credentials.json")

# Initialize Firebase
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("[FIREBASE] Initialized successfully.")
    except Exception as e:
        print(f"[FIREBASE] Failed to initialize: {e}")

db = firestore.client()

app = FastAPI(title="AccessiScan AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/history")
async def get_scan_history(limit: int = 50):
    """Fetch the latest scans from Firestore."""
    try:
        scans_ref = db.collection("scans").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)
        docs = scans_ref.stream()
        
        history = []
        for doc in docs:
            data = doc.to_dict()
            history.append({
                "id": doc.id,
                "url": data.get("url"),
                "timestamp": data.get("timestamp").isoformat() if data.get("timestamp") else None,
                "score": data.get("score"),
                "report": data.get("summary")
            })
        return history
    except Exception as e:
        print(f"[FIREBASE] History fetch failed: {e}")
        return []

# Load and index custom accessibility rules
with open(config.RULES_FILE, "r", encoding="utf-8") as f:
    RAW_RULES = json.load(f)

RULES_BY_ID = {rule["rule_id"]: rule for rule in RAW_RULES.get("wcag_dictionary", [])}


async def perform_groq_analysis(url: str, dom: str, wcag_level: str) -> list:
    """Specialized analysis for Motor and Cognitive disabilities using Groq."""
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        print("[WARN] GROQ_API_KEY not found. Skipping specialized analysis.")
        return []

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(dom, "html.parser")
    for tag in soup(["script", "style", "svg", "path", "iframe", "noscript", "canvas", "head"]):
        tag.decompose()
    clean_dom = str(soup)[:40000]

    prompt = f"""You are an accessibility expert specializing in MOTOR and COGNITIVE disabilities.
Audit this page for exactly 5 high-impact issues related to:
1. Motor Skills (e.g., target size, keyboard traps, rapid timing).
2. Cognitive Skills (e.g., complex navigation, inconsistent layouts, readability).

URL: {url}
WCAG: {wcag_level}
DOM: {clean_dom}

Return ONLY a JSON list of 5 issues. 
CRITICAL: 'bad_code' and 'fixed_code' MUST be valid, functional HTML snippets. 
DO NOT use placeholders like '...' or 'text'. 
For Motor fixes, show attributes like 'min-width: 44px', 'tabindex', or 'aria-live'.
For Cognitive fixes, show structural improvements like 'aria-describedby' or simplified DOM structures.

[
  {{
    "code": "motor-cognitive-id",
    "title": "Clear Title",
    "description": "Short explanation",
    "wcag_mapping": "Success Criterion",
    "disability_impact": "Motor / Cognitive",
    "pour_principle": "Operable / Understandable",
    "severity_justification": "Why it matters",
    "pour_justification": "POUR alignment",
    "human_impact": {{
      "problem": "...",
      "disability_group": "...",
      "effects": ["...", "..."],
      "real_world_example": "..."
    }},
    "bad_code": "<button>Low Target</button>",
    "fixed_code": "<button style='min-width: 44px; min-height: 44px;'>Better Target</button>",
    "solution_overview": ["Step 1", "Step 2"],
    "affected_element": "CSS Selector or Description"
  }}
]
"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2
                }
            )
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            # Extract JSON if wrapped in markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            return json.loads(content)
    except Exception as e:
        print(f"[ERROR] Groq analysis failed: {e}")
        return []

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: str
    wcag_level: str = "AA"

class Proof(BaseModel):
    page_url: str = ""
    selector: str = ""
    html_snippet: str = ""
    element_screenshot: Optional[str] = None  # base664 image

class Issue(BaseModel):
    code: str = ""
    axe_id: Optional[str] = None
    title: str = "Unknown Issue"
    description: str = ""
    wcag_mapping: str = ""
    disability_impact: str = ""
    pour_principle: str = ""
    severity_justification: str = ""
    pour_justification: str = ""
    human_impact: dict = {"problem": "", "disability_group": "", "effects": [], "real_world_example": ""}
    bad_code: str = ""
    fixed_code: str = ""
    solution_overview: List[str] = []
    act_rules: Optional[List[dict]] = []
    affected_element: Optional[str] = None
    proof: Optional[Proof] = None

class AuditReport(BaseModel):
    overview: dict = {
        "total_issues": 0,
        "severity_breakdown": {"Critical": 0, "Serious": 0, "Moderate": 0, "Minor": 0},
        "pour_scores": {"Perceivable": 0, "Operable": 0, "Understandable": 0, "Robust": 0, "overall": 0},
        "accessibility_summary": ""
    }
    issues: List[Issue]
    detailed_analysis: dict
    final_summary: dict
    nav_links: List[dict] = []
    full_page_screenshot: Optional[str] = None  # base64

class RemediateRequest(BaseModel):
    selected_issues: List[dict]
    user_query: str
    history: List[dict] = []
    context: Optional[dict] = None # {techStack: {...}, currentFile: "...", sourceCode: "..."}

class GithubIssueRequest(BaseModel):
    token: str
    repo_url: str
    title: str
    body: str

class GithubPRRequest(BaseModel):
    token: str
    repo_url: str
    branch: str = "main"
    title: str
    body: str
    changes: List[dict] # [{"path": "...", "content": "..."}]

class GithubAnalyzeRequest(BaseModel):
    token: str
    repo_url: str

class GithubSearchRequest(BaseModel):
    token: str
    repo_url: str
    wcag_id: str
    html_snippet: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

AXE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js"

async def get_axe_script() -> str:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(AXE_CDN_URL)
            if response.status_code == 200:
                return response.text
    except Exception as e:
        print(f"Warning: Could not fetch axe-core from CDN: {e}")
    return ""


def get_rules_for_level(level: str) -> list:
    level_hierarchy = {"A": ["A"], "AA": ["A", "AA"], "AAA": ["A", "AA", "AAA"]}
    allowed = level_hierarchy.get(level.upper(), ["A", "AA"])
    return [
        rule for rule in RAW_RULES.get("wcag_dictionary", [])
        if rule.get("conformance_level") in allowed
    ]


def build_minimal_rules(rules: list) -> list:
    minimal = []
    for rule in rules:
        act_titles = [r.get("title", "") for r in rule.get("act_rules", [])]
        minimal.append({
            "rule_id": rule.get("rule_id"),
            "criterion": rule.get("success_criterion"),
            "level": rule.get("conformance_level"),
            "principle": rule.get("principle"),
            "description": rule.get("description", "")[:200],
            "act_checks": act_titles
        })
    return minimal


def enrich_issues_with_rules(issues: list, proof_map: dict) -> list:
    """
    Phase 2: Attach full rule data + proof.
    AI now includes axe_id in each issue for direct proof lookup.
    Falls back to index-based assignment if no axe_id match.
    """
    proof_list = list(proof_map.values())  # ordered list of proofs
    enriched = []
    for i, issue in enumerate(issues):
        code = issue.get("code", "")
        axe_id = issue.get("axe_id", "")
        rule = RULES_BY_ID.get(code, {})

        # Ensure human_impact is robust
        hi = issue.get("human_impact", {})
        if not isinstance(hi, dict): hi = {}
        issue["human_impact"] = {
            "problem": hi.get("problem") or "Accessibility barrier detected.",
            "disability_group": hi.get("disability_group") or rule.get("principle", "General Users"),
            "effects": hi.get("effects") or ["Users may struggle to interact with this element adequately."],
            "real_world_example": hi.get("real_world_example") or "A user attempting to complete a task will experience a significant delay or block in their workflow."
        }

        # ─── Fix: Ensure Success Criterion Mapping ───
        if not issue.get("wcag_mapping"):
            issue["wcag_mapping"] = rule.get("success_criterion") or "N/A"

        # 1. Try direct axe_id match
        proof = proof_map.get(axe_id, None)
        # 2. Fallback: assign by index (issue 0 → proof 0, etc.)
        if not proof and i < len(proof_list):
            proof = proof_list[i]

        enriched.append({
            **issue,
            "act_rules": rule.get("act_rules", []),
            "wcag_mapping": rule.get("success_criterion", issue.get("wcag_mapping", code)),
            "disability_impact": hi.get("disability_group") or "General",
            "proof": proof
        })
    return enriched


async def capture_element_proofs(page, violations: list, page_url: str) -> dict:
    """
    For each axe violation, capture:
    - The CSS selector of the first affected node
    - The HTML snippet of that element
    - A screenshot of the element itself
    Returns a dict: { axe_violation_id -> proof_dict }
    """
    proof_map = {}

    for violation in violations[:20]:  # Capture up to 20 for broader audit
        axe_id = violation.get("id", "")
        nodes = violation.get("nodes", [])
        if not nodes:
            continue

        # Get first affected node
        node = nodes[0]
        target = node.get("target", [])
        html = node.get("html", "")

        selector = target[0] if target else ""
        element_screenshot_b64 = None

        if selector:
            try:
                locator = page.locator(selector).first
                # Take screenshot of just the element
                el_bytes = await locator.screenshot(timeout=5000)
                element_screenshot_b64 = base64.b64encode(el_bytes).decode("utf-8")
            except Exception as e:
                print(f"[WARN] Could not screenshot element '{selector}': {e}")

        proof_map[axe_id] = {
            "page_url": page_url,
            "selector": selector,
            "html_snippet": html[:500],
            "element_screenshot": element_screenshot_b64
        }

    return proof_map


# ─── AI Audit ─────────────────────────────────────────────────────────────────

async def perform_ai_audit(url: str, dom: str, axe_violations: list, wcag_level: str) -> dict:
    # Sanitize DOM
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(dom, "html.parser")
    # Remove non-visible or irrelevant tags to save tokens
    for tag in soup(["script", "style", "svg", "path", "iframe", "noscript", "canvas", "head"]):
        tag.decompose()
    # Increase to 80,000 chars to cover more of the page content
    clean_dom = str(soup)[:80000]

    # Capture more axe violations for better coverage
    axe_summary = []
    for v in axe_violations[:20]:
        node_html = v.get("nodes", [{}])[0].get("html", "") if v.get("nodes") else ""
        axe_summary.append({
            "id": v.get("id"),
            "impact": v.get("impact"),
            "description": v.get("description", "")[:150],
            "affected_html": node_html[:150]
        })

    # Build minimal rules payload
    level_rules = get_rules_for_level(wcag_level)
    minimal_rules = build_minimal_rules(level_rules)
    rules_json = json.dumps(minimal_rules, separators=(",", ":"))[:12000]
    axe_json = json.dumps(axe_summary, separators=(",", ":"))

    prompt = f"""You are an expert WCAG 2.2 accessibility auditor. Audit: {url}
WCAG Target Level: {wcag_level}

STEP 1 - Analyze the DOM snippet against the RULES to find original WCAG violations (source: "custom-rules").
STEP 2 - Review the AXE-CORE TOP VIOLATIONS to include them as well (source: "axe-core").
STEP 3 - Combine BOTH sets of issues. You MUST find and list issues from the DOM using our custom RULES, do not just parrot axe-core.
STEP 5 - Under 'human_impact', provide: 
   1. "problem": (Deep analysis of the specific bug).
   2. "disability_group": (Specific group impacted).
   3. "effects": (2-3 bullet points of technical usage failure).
   4. "real_world_example": (Mandatory: Write a concrete, personalized scenario of a user failing. Example: 'A visually impaired student trying to view their exam schedule will experience...' or 'A professional with motor disability attempting to submit a form will feel...').
STEP 6 - Under 'solution_overview', provide 2-3 technical fix steps.
STEP 7 - Provide "bad_code" and "fixed_code" as literal HTML.
STEP 8 - Provide reasoning for WCAG mapping (ensure it's not empty!) and Severity score.
STEP 9 - Calculate individual POUR scores (0-100) based on findings. "overall" is the weighted average.
STEP 10 - Ensure "wcag_mapping" and "disability_impact" are ALWAYS explicitly filled.

RULES (use rule_id strings exactly as given):
{rules_json}

AXE-CORE TOP VIOLATIONS:
{axe_json}

DOM SNIPPET:
{clean_dom}

Return ONLY valid JSON:
{{
  "overview": {{
    "total_issues": 0,
    "severity_breakdown": {{"Critical": 0, "Serious": 0, "Moderate": 0, "Minor": 0}},
    "pour_scores": {{"Perceivable": 80, "Operable": 85, "Understandable": 90, "Robust": 75, "overall": 82}},
    "accessibility_summary": "Brief summary."
  }},
  "issues": [
    {{
      "code": "wcag_1_1_1",
      "axe_id": "image-alt",
      "title": "Short title",
      "description": "What the issue is",
      "affected_element": "<img src='...' />",
      "source": "axe-core",
      "severity": "Serious",
      "wcag_mapping": "1.1.1",
      "disability_impact": "Visual",
      "pour_principle": "Perceivable",
      "severity_justification": "This prevents users from perceiving core content.",
      "pour_justification": "Non-text content lacks a text alternative.",
      "human_impact": {{
        "problem": "Images in the slideshow lack alternative text.",
        "disability_group": "Visually Impaired / Screen Reader Users",
        "effects": [
          "Users cannot understand the visual context of the ceremony images",
          "Screen readers will announce the file name, which is confusing"
        ],
        "real_world_example": "A student visiting the portal to see their graduation photos... will hear the screen reader stutter through 'award_2_1_b.jpg' instead of 'Students receiving award certificates from the Dean', leaving them excluded from the school's highlights."
      }},
      "bad_code": "<img src='logo.png'>",
      "fixed_code": "<img src='logo.png' alt='Company Name Logo'>",
      "solution_overview": [
        "Identified the missing alt attribute",
        "Drafted a descriptive text based on local context",
        "Applied WCAG 1.1.1 compliant alternative text"
      ],
      "fix_recommendation": "Add a descriptive alt attribute to the img tag."
    }}
  ],
  "detailed_analysis": {{
    "Perceivable": "Analysis.",
    "Operable": "Analysis.",
    "Understandable": "Analysis.",
    "Robust": "Analysis."
  }},
  "final_summary": {{
    "priority_fixes": ["Fix 1", "Fix 2"],
    "overall_rating": "Needs Improvement"
  }}
}}"""

    headers = {
        "Authorization": f"Bearer {config.FEATHERLESS_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": config.MODEL_NAME,
        "messages": [
            {"role": "system", "content": "You are an expert accessibility auditor. Output only valid JSON. Be concise."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 8192
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(config.FEATHERLESS_API_URL, headers=headers, json=payload)
        if response.status_code != 200:
            raise Exception(f"AI API Error: {response.text}")

        result = response.json()
        raw_content = result["choices"][0]["message"]["content"]
        print(f"[AI] Response length: {len(raw_content)} chars")
        print(f"[AI] Preview: {raw_content[:200]}")

        if not raw_content or not raw_content.strip():
            raise Exception("AI returned an empty response.")

        stripped = raw_content.strip()
        if stripped.startswith("```"):
            stripped = stripped.split("```")[1]
            if stripped.startswith("json"):
                stripped = stripped[4:]

        return json.loads(stripped)


# ─── Scan Endpoint ────────────────────────────────────────────────────────────

@app.post("/scan", response_model=AuditReport)
async def scan_url(request: ScanRequest):
    url = request.url
    wcag_level = request.wcag_level.upper()

    if not url.startswith("http"):
        url = "https://" + url

    axe_script = await get_axe_script()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Fix: bypass_csp=True is often needed for sites like YouTube with strict security
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            bypass_csp=True
        )
        page = await context.new_page()

        try:
            print(f"[SCAN] Navigating to {url} | WCAG Level: {wcag_level}")
            try:
                # Use domcontentloaded for heavy sites like YouTube
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            except Exception as e:
                print(f"[WARN] Navigation timeout but proceeding with partial DOM: {e}")

            # Full-page screenshot (for report preview)
            full_ss_bytes = await page.screenshot(full_page=False)
            full_ss_b64 = base64.b64encode(full_ss_bytes).decode("utf-8")

            # Extract DOM
            dom_content = await page.content()

            # Run axe-core
            axe_results = {"violations": [], "incomplete": []}
            if axe_script:
                print("[SCAN] Running axe-core...")
                try:
                    # Fix: Injection for strict sites like YouTube (bypass Trusted Types)
                    await page.evaluate(axe_script)
                    await asyncio.sleep(0.5)
                    axe_results = await page.evaluate("axe.run()")
                except Exception as e:
                    print(f"[WARN] axe-core failed: {e}")

            violations = axe_results.get("violations", [])
            print(f"[SCAN] Axe found {len(violations)} violations")

            # Capture element-level proofs for top 5 violations
            print("[SCAN] Capturing element proofs...")
            proof_map = await capture_element_proofs(page, violations, url)

            # AI analysis
            print("[SCAN] Sending to AI for analysis...")
            # Parallelize Analysis
            ai_task = perform_ai_audit(url, dom_content, violations, wcag_level)
            groq_task = perform_groq_analysis(url, dom_content, wcag_level)
            
            ai_audit_results, groq_issues = await asyncio.gather(ai_task, groq_task)

            # Combine issues
            base_issues = ai_audit_results.get("issues", [])
            
            # Process Groq issues to ensure they have the same structure
            processed_groq = []
            for g_issue in groq_issues:
                processed_groq.append({
                    **g_issue,
                    "axe_id": None, # Groq issues don't have axe_ids
                    "proof": None   # No screenshots for Groq issues yet
                })

            all_issues = base_issues + processed_groq
            
            # Phase 2: Enrich with proof mapping
            enriched_issues = enrich_issues_with_rules(all_issues, proof_map)
            ai_audit_results["full_page_screenshot"] = full_ss_b64

            # Extract navigation links
            nav_elements = await page.query_selector_all("a")
            nav_links = []
            for el in nav_elements:
                try:
                    text = (await el.inner_text()).strip()
                    href = await el.get_attribute("href")
                    if text and href and not href.startswith("javascript:") and not href.startswith("#"):
                        # Ensure absolute URL
                        if not href.startswith("http"):
                            from urllib.parse import urljoin
                            href = urljoin(url, href)
                        nav_links.append({"text": text, "href": href})
                except:
                    continue

            # Unique links only
            seen_hrefs = set()
            unique_nav = []
            for link in nav_links:
                if link["href"] not in seen_hrefs:
                    unique_nav.append(link)
                    seen_hrefs.add(link["href"])

            # Phase 2: Enrich with proof mapping
            enriched_issues = enrich_issues_with_rules(all_issues, proof_map)

            # ─── Calculate Logarithmic Score ───
            # Weights: Critical: 10, Serious: 5, Moderate: 2, Minor: 1
            weights = {"Critical": 10, "Serious": 5, "Moderate": 2, "Minor": 1}
            total_weighted_impact = 0
            for issue in enriched_issues:
                # Severity can be "Critical", "Serious", etc. handled by enrich_issues_with_rules or AI
                sev = issue.get("severity", "Minor") 
                total_weighted_impact += weights.get(sev, 1)
            
            import math
            log_penalty = 20 * math.log10(1 + total_weighted_impact)
            calculated_score = max(0, round(100 - log_penalty))
            
            ai_audit_results["overview"]["pour_scores"]["overall"] = calculated_score
            ai_audit_results["overview"]["total_issues"] = len(enriched_issues)

            report = AuditReport(
                overview=ai_audit_results["overview"],
                issues=[Issue(**i) for i in enriched_issues], 
                detailed_analysis=ai_audit_results.get("detailed_analysis", {}),
                final_summary=ai_audit_results.get("final_summary", {
                    "overall_rating": f"{calculated_score}/100",
                    "priority_fixes": []
                }),
                nav_links=list(unique_nav)[:25], 
                full_page_screenshot=full_ss_b64
            )

            # ─── Save to Firebase ───
            try:
                # Firestore requires plain dicts without complex Pydantic objects
                report_dict = json.loads(report.json())
                db.collection("scans").add({
                    "url": url,
                    "timestamp": datetime.utcnow(),
                    "score": calculated_score,
                    "summary": report_dict
                })
                print(f"[FIREBASE] Scan saved for {url}")
            except Exception as fe:
                print(f"[FIREBASE] Failed to save scan: {fe}")

            return report

        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            await browser.close()


@app.post("/remediate")
async def remediate_issues(request: RemediateRequest):
    """Chat with AI to discuss and fix selected accessibility issues."""
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured on server.")

    framework = "HTML"
    language = "JavaScript"
    file_path = "Unknown"
    source_code = ""
    
    if request.context is not None:
        ctx = request.context
        tech_stack = ctx.get("techStack", {}) or {}
        framework = tech_stack.get("framework", "HTML")
        language = tech_stack.get("language", "JavaScript")
        file_path = ctx.get("currentFile", "Unknown")
        source_code = ctx.get("sourceCode", "")

    # Fallback: If framework is Unknown but file is .tsx/.jsx, it's React
    if framework == "Unknown" and file_path.lower().split('.')[-1] in ["tsx", "jsx"]:
        framework = "React"
        print(f"[REMEDIATE] 💡 Fallback: Detected {framework} from file extension {file_path}")

    # Build issues summary — DELIBERATELY omit DOM element HTML to prevent AI from using it as BEFORE code
    issues_text = ""
    for i, issue in enumerate(request.selected_issues, 1):
        issues_text += f"""
Issue {i}: {issue.get('title')} [{issue.get('code')}]
  Description: {issue.get('description')}
  WCAG: {issue.get('wcag_criteria', 'N/A')}
  NOTE: Find the relevant code in the SOURCE FILE provided above to fix this issue.
"""

    has_source = bool(source_code and source_code.strip() and "mapping failed" not in source_code)
    
    if has_source:
        # Truncate to 150 lines to prevent Groq context overflow
        source_lines = source_code.split("\n")
        if len(source_lines) > 150:
            source_code_trimmed = "\n".join(source_lines[:150]) + f"\n\n... [truncated {len(source_lines) - 150} more lines] ..."
        else:
            source_code_trimmed = source_code

        source_section = f"""
====================================================================
ACTUAL SOURCE FILE: {file_path}
Framework: {framework} | Language: {language}
====================================================================
{source_code_trimmed}
====================================================================
END OF SOURCE FILE
====================================================================
"""
    else:
        source_code_trimmed = ""
        source_section = f"""
NO SOURCE FILE AVAILABLE.
Framework: {framework} | Language: {language}
Since there is no source file, write a realistic {framework} JSX fix with placeholder props.
"""

    system_prompt = f"""You are a Senior {framework} Accessibility Engineer performing a code review.

{"=" * 60}
SOURCE FILE PROVIDED:
{source_section}
{"=" * 60}

ACCESSIBILITY ISSUES TO FIX:
{issues_text}

{"=" * 60}
STRICT RULES — READ CAREFULLY:
{"=" * 60}

RULE 0: Before every fix code block, write a 2-3 sentence explanation:
         - What element is affected and what's wrong with it
         - Why this fix resolves the accessibility issue
         - Which users/disabilities benefit from this change
         Example: "The `<main>` landmark is missing a `role` attribute which causes screen readers
         to skip this region. Adding `role='main'` ensures assistive technologies correctly identify
         the primary content area. This benefits users with visual impairments using screen readers."

RULE 1: The BEFORE block MUST be copied VERBATIM from the source file above.
         - Search the source file for any line that matches the issue.
         - Never copy HTML from the DOM element description.
         - Never use `class=` — the source is JSX which uses `className=`.

RULE 2: If you CANNOT find the affected code in the source file, write:
         SKIP: [reason — element not found in {file_path}]
         Do NOT fabricate a fix based on the DOM element description.

RULE 3: ALL fixes must use {framework} syntax:
         - Use `className` not `class`
         - Use `htmlFor` not `for`
         - Use `aria-label={{...}}` JSX style
         - Do NOT write `<html lang="en">` — that is HTML, not JSX

RULE 4: Each fix MUST follow this EXACT format inside a single code block:

```tsx
// --- BEFORE ---
<paste exact line(s) from source file>

// --- AFTER ---
<fixed version using {framework} syntax>
```

RULE 5: One code block per issue. Do NOT mix multiple issues in one block.

RULE 6: End each fix with: **WCAG:** [criterion number and name]
"""

    messages = [{"role": "system", "content": system_prompt}]
    # Add history
    history = request.history or []
    for h in history[-5:]: # Last 5 turns for context
        messages.append(h)
    messages.append({"role": "user", "content": request.user_query})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": messages,
                    "temperature": 0.5
                }
            )
            data = response.json()
            if "choices" not in data:
                err_detail = data.get("error", {}).get("message", str(data))[:300]
                print(f"[REMEDIATE ERROR] Groq returned no choices: {err_detail}")
                raise HTTPException(status_code=500, detail=f"AI API error: {err_detail}")
            return {"content": data["choices"][0]["message"]["content"]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[REMEDIATE ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/github/issue")
async def create_github_issue(request: GithubIssueRequest):
    """Create a GitHub issue via the GitHub API."""
    # Extract owner/repo from URL
    # Format: https://github.com/owner/repo
    parts = request.repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid GitHub Repository URL.")
    
    owner, repo = parts[-2], parts[-1]
    api_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            api_url,
            headers={
                "Authorization": f"token {request.token}",
                "Accept": "application/vnd.github.v3+json"
            },
            json={
                "title": request.title,
                "body": request.body
            }
        )
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        return response.json()

@app.post("/github/analyze")
async def analyze_github_repo(request: GithubAnalyzeRequest):
    """Detect tech stack (React, TypeScript, etc.) from a GitHub repository."""
    parts = request.repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid GitHub Repository URL.")
    
    owner, repo = parts[-2], parts[-1]
    base_url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Authorization": f"token {request.token}",
        "Accept": "application/vnd.github.v3+json"
    }

    async with httpx.AsyncClient() as client:
        # Detect framework and language by checking root and subdirectories
        tech_profile = {
            "framework": "Unknown",
            "language": "JavaScript",
            "is_compiled": False,
            "has_package_json": False
        }

        # List of potential locations for package.json or tech markers
        locations = ["", "frontend", "client", "app", "src", "web"]
        
        for loc in locations:
            path_prefix = f"{loc}/" if loc else ""
            
            # 1. Try package.json
            pkg_res = await client.get(f"{base_url}/contents/{path_prefix}package.json", headers=headers)
            if pkg_res.status_code == 200:
                tech_profile["has_package_json"] = True
                try:
                    content = base64.b64decode(pkg_res.json()["content"]).decode()
                    pkg_data = json.loads(content)
                    deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
                    
                    if "react" in deps: tech_profile["framework"] = "React"
                    elif "vue" in deps: tech_profile["framework"] = "Vue"
                    elif "@angular/core" in deps: tech_profile["framework"] = "Angular"
                    elif "next" in deps: tech_profile["framework"] = "Next.js"
                    elif "svelte" in deps: tech_profile["framework"] = "Svelte"
                    
                    if "typescript" in deps: tech_profile["language"] = "TypeScript"
                    tech_profile["is_compiled"] = True
                    
                    # If we found a framework, we can stop searching locations
                    if tech_profile["framework"] != "Unknown":
                        break
                except:
                    pass

            # 2. Try tsconfig.json explicitly if language is still JS
            if tech_profile["language"] == "JavaScript":
                ts_res = await client.get(f"{base_url}/contents/{path_prefix}tsconfig.json", headers=headers)
                if ts_res.status_code == 200:
                    tech_profile["language"] = "TypeScript"
                    tech_profile["is_compiled"] = True

        return tech_profile

@app.post("/github/search-code")
async def search_github_code(request: GithubSearchRequest):
    """Attempt to find the source file for a given HTML snippet using multiple search strategies."""
    if not request.repo_url or not request.token:
        return {"matches": [], "debug": {"reason": "missing_repo_url_or_token"}}
    
    parts = request.repo_url.rstrip("/").split("/")
    if len(parts) < 2 or not parts[-1] or not parts[-2]:
        return {"matches": [], "debug": {"reason": "invalid_repo_url", "url": request.repo_url}}
    
    owner, repo = parts[-2], parts[-1]
    print(f"[SEARCH] owner={owner} repo={repo}")
    
    headers = {
        "Authorization": f"token {request.token}",
        "Accept": "application/vnd.github.v3+json"
    }

    import re
    snippet = request.html_snippet or ""
    
    print(f"\n{'='*60}")
    print(f"[SEARCH] WCAG Issue: {request.wcag_id}")
    print(f"[SEARCH] Repo: {owner}/{repo}")
    print(f"[SEARCH] DOM Snippet (first 300 chars):\n  {snippet[:300]}")
    print(f"{'='*60}")

    # ── Strategy 1: Extract unique class names (non-Tailwind) ──
    classes = []
    for m in re.finditer(r'class(?:Name)?=["\']([^"\']+)["\']', snippet):
        classes.extend(m.group(1).split())
    # Filter out Tailwind/generic utility classes
    tailwind_prefixes = ("flex", "grid", "p-", "m-", "w-", "h-", "bg-", "text-", "border", 
                         "rounded", "shadow", "space-", "gap-", "items-", "justify-", "absolute",
                         "relative", "hidden", "block", "inline", "overflow", "z-", "min-", "max-",
                         "font-", "leading-", "tracking-", "opacity-", "cursor-", "pointer-")
    unique_classes = [c for c in classes if not any(c.startswith(g) for g in tailwind_prefixes) and len(c) > 3]
    print(f"[SEARCH] All classes found: {classes[:10]}")
    print(f"[SEARCH] Unique (non-generic) classes: {unique_classes[:5]}")

    # ── Strategy 2: Extract IDs ──
    ids = re.findall(r'id=["\']([^"\']+)["\']', snippet)
    print(f"[SEARCH] IDs found: {ids}")

    # ── Strategy 3: Extract text content ──
    text_content = re.sub(r'<[^>]+>', ' ', snippet).strip()
    words = [w for w in text_content.split() if len(w) > 4 and w.isalpha()]
    print(f"[SEARCH] Text content words: {words[:10]}")

    # ── Strategy 4: Extract tag + attribute combos ──
    aria_attrs = re.findall(r'(aria-[a-z]+)=["\']([^"\']*)["\']', snippet)
    role_attrs = re.findall(r'role=["\']([^"\']+)["\']', snippet)
    print(f"[SEARCH] ARIA attrs: {aria_attrs}")
    print(f"[SEARCH] Role attrs: {role_attrs}")

    # Build prioritized list of search queries
    search_candidates = []
    
    for cls in unique_classes[:3]:
        search_candidates.append(("unique_class", f"repo:{owner}/{repo} {cls}", cls))
    
    for eid in ids[:2]:
        search_candidates.append(("id_attr", f"repo:{owner}/{repo} {eid}", eid))
    
    for word in words[:3]:
        search_candidates.append(("text_content", f"repo:{owner}/{repo} \"{word}\"", word))
    
    for attr, val in aria_attrs[:2]:
        if val:
            search_candidates.append(("aria_attr", f"repo:{owner}/{repo} {attr}=\"{val}\"", f"{attr}={val}"))

    # Also try source file extensions
    src_exts = ["jsx", "tsx", "vue", "svelte", "js", "ts"]
    
    print(f"\n[SEARCH] Will try {len(search_candidates)} search strategies:")
    for i, (strategy, q, term) in enumerate(search_candidates):
        print(f"  [{i+1}] Strategy={strategy} | Term='{term}' | Query='{q}'")
    
    if not search_candidates:
        print("[SEARCH] ❌ No search candidates generated. Returning empty matches.")
        return {"matches": [], "debug": {"reason": "no_search_candidates", "snippet": snippet[:200]}}

    async with httpx.AsyncClient(timeout=30.0) as client:
        matches = []
        seen_paths = set()

        for strategy, search_query, term in search_candidates:
            if len(matches) >= 3:
                break
            
            search_url = f"https://api.github.com/search/code?q={search_query}"
            print(f"\n[SEARCH] Trying [{strategy}] query: {search_query}")
            res = await client.get(search_url, headers=headers)
            
            print(f"[SEARCH]   → HTTP {res.status_code}")
            if res.status_code == 403:
                print(f"[SEARCH]   → ⚠️ Rate limited! GitHub Code Search requires a Fine-Grained Token with 'code' read scope.")
                return {"matches": [], "debug": {"reason": "rate_limited_or_permission", "detail": res.text[:200]}}

            if res.status_code != 200:
                print(f"[SEARCH]   → Error: {res.text[:200]}")
                continue

            data = res.json()
            total_count = data.get("total_count", 0)
            items = data.get("items", [])
            print(f"[SEARCH]   → Found {total_count} total results, processing top {min(len(items), 3)}")

            for item in items[:5]:
                path = item.get("path", "")
                path_lower = path.lower()
                
                # Score based on file extension relevance
                score = 0
                if any(path.endswith(f".{e}") for e in ["jsx", "tsx"]): score += 10
                elif any(path.endswith(f".{e}") for e in ["vue", "svelte"]): score += 8
                elif any(path.endswith(f".{e}") for e in ["js", "ts"]): score += 5
                elif path.endswith(".html"): score += 2

                # Boost component/page/view/layout files
                import os as _os
                filename = _os.path.basename(path_lower)
                parent_dirs = path_lower.replace("\\", "/").split("/")
                if any(d in parent_dirs for d in ["components", "component", "pages", "page", "views", "view", "layouts", "layout", "sections", "features", "ui", "atoms", "molecules"]):
                    score += 12
                    print(f"[SEARCH]   → 📁 Component dir bonus: +12 for {path}")

                # Penalize entry points and config files
                entry_files = {"main.tsx", "main.ts", "main.jsx", "main.js", "index.tsx", "index.ts", "index.js",
                               "app.tsx", "app.ts", "vite.config.ts", "vite.config.js", "webpack.config.js",
                               "tailwind.config.js", "tsconfig.json", "setupTests.ts", "_app.tsx", "_document.tsx", "next.config.js"}
                if filename in entry_files:
                    score -= 15
                    print(f"[SEARCH]   → ⚠️ Entry-point penalty: -15 for {path}")

                # Penalize test, generated, and vendor files
                if any(x in path_lower for x in ["node_modules", "__tests__", ".test.", ".spec.", ".min.", ".d.ts", "dist/", "build/", ".next/"]):
                    score -= 20
                
                print(f"[SEARCH]   → File: {path} | Score: {score} | Strategy: {strategy}")

                if path in seen_paths or score < 0:
                    print(f"[SEARCH]     Skipping (seen or negative score)")
                    continue
                
                seen_paths.add(path)
                
                # Fetch the file content
                file_url = item.get("url")
                print(f"[SEARCH]     Fetching content from: {file_url}")
                file_res = await client.get(file_url, headers=headers)
                
                if file_res.status_code == 200:
                    file_data = file_res.json()
                    content_raw = file_data.get("content", "")
                    try:
                        content = base64.b64decode(content_raw).decode("utf-8", errors="replace")
                    except Exception:
                        content = content_raw
                    
                    print(f"[SEARCH]     ✅ Got content ({len(content)} chars)")
                    print(f"[SEARCH]     First 200 chars of file: {content[:200]}")
                    
                    matches.append({
                        "file_path": path,
                        "content": content,
                        "url": item.get("html_url"),
                        "status": "mapped",
                        "strategy": strategy,
                        "match_term": term,
                        "score": score
                    })
                else:
                    print(f"[SEARCH]     ❌ Failed to fetch content: HTTP {file_res.status_code}")
        
        # Sort matches by score descending
        matches.sort(key=lambda x: x.get("score", 0), reverse=True)
        
        print(f"\n[SEARCH] Final result: {len(matches)} file(s) matched")
        for m_item in matches:
            print(f"  → {m_item['file_path']} (score={m_item.get('score')}, strategy={m_item.get('strategy')})")
        print(f"{'='*60}\n")
        
        return {
            "matches": matches,
            "debug": {
                "strategies_tried": len(search_candidates),
                "total_matches": len(matches),
                "unique_classes": unique_classes[:5],
                "ids": ids,
            }
        }



@app.post("/github/pr")
async def create_github_pr(request: GithubPRRequest):
    """Create a GitHub PR by creating a new branch and committing changes."""
    parts = request.repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid GitHub Repository URL.")
    
    owner, repo = parts[-2], parts[-1]
    base_url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Authorization": f"token {request.token}",
        "Accept": "application/vnd.github.v3+json"
    }

    async with httpx.AsyncClient() as client:
        # 1. Get default branch SHA
        ref_res = await client.get(f"{base_url}/git/ref/heads/{request.branch}", headers=headers)
        if ref_res.status_code != 200:
            raise HTTPException(status_code=ref_res.status_code, detail="Could not find base branch.")
        
        base_sha = ref_res.json()["object"]["sha"]
        new_branch = f"accessiscan-fix-{int(datetime.now().timestamp())}"

        # 2. Create new branch
        create_branch_res = await client.post(
            f"{base_url}/git/refs",
            headers=headers,
            json={"ref": f"refs/heads/{new_branch}", "sha": base_sha}
        )
        if create_branch_res.status_code != 201:
            raise HTTPException(status_code=create_branch_res.status_code, detail="Failed to create branch.")

        # 3. Create/Update files
        for change in request.changes:
            path = change["path"]
            content = change["content"]
            
            # Get existing file SHA if it exists
            file_res = await client.get(f"{base_url}/contents/{path}?ref={new_branch}", headers=headers)
            file_sha = None
            if file_res.status_code == 200:
                file_sha = file_res.json()["sha"]
            
            await client.put(
                f"{base_url}/contents/{path}",
                headers=headers,
                json={
                    "message": f"Remediate accessibility issues in {path}",
                    "content": base64.b64encode(content.encode()).decode(),
                    "branch": new_branch,
                    "sha": file_sha if file_sha else None
                }
            )

        # 4. Create Pull Request
        pr_res = await client.post(
            f"{base_url}/pulls",
            headers=headers,
            json={
                "title": request.title,
                "body": request.body,
                "head": new_branch,
                "base": request.branch
            }
        )
        if pr_res.status_code != 201:
            raise HTTPException(status_code=pr_res.status_code, detail="Failed to create PR.")
        
        return pr_res.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
