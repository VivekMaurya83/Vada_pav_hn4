"""
Pydantic models for request/response validation.
"""

from pydantic import BaseModel, HttpUrl, Field
from typing import Optional
from datetime import datetime


# ─── Scan Endpoint ────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: HttpUrl = Field(..., description="The URL of the web page to scan for accessibility issues.")


class IssueDetail(BaseModel):
    rule_id: str = Field(..., description="WCAG rule ID from our dictionary (e.g., wcag_1_1_1)")
    axe_rule_id: str = Field(..., description="The original axe-core rule ID (e.g., image-alt)")
    impact: str = Field(..., description="Severity: critical, serious, moderate, minor")
    description: str = Field(..., description="Human-readable description of the violation")
    failure_summary: str = Field("", description="Specific error summary from axe-core for this element")
    help_url: str = Field("", description="Link to axe-core documentation for this rule")
    wcag_criterion: str = Field("", description="WCAG success criterion (e.g., 1.1.1 Non-text Content)")
    html_snippet: str = Field("", description="The broken HTML element that caused the violation")
    css_selector: str = Field("", description="CSS selector targeting the broken element")
    conformance_level: str = Field("", description="WCAG conformance level: A, AA, or AAA")
    principle: str = Field("", description="WCAG principle: Perceivable, Operable, Understandable, Robust")
    featherless_prompt_context: str = Field("", description="Prompt context for AI remediation")
    impact_description: str = Field("", description="Full impact explanation from the WCAG dictionary")
    common_failures: list[str] = Field(default_factory=list, description="Common failure patterns for this rule")
    affected_users: list[str] = Field(default_factory=list, description="User groups affected by this issue")
    test_procedure: str = Field("", description="How to test/verify this issue")
    is_incomplete: bool = Field(False, description="Whether this issue needs manual review (common for contrast)")


class ScanResponse(BaseModel):
    url: str
    score: int = Field(..., ge=0, le=100, description="Accessibility score out of 100")
    total_issues: int
    issues: list[IssueDetail]
    scanned_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ─── Remediate Endpoint ──────────────────────────────────────────

class RemediateRequest(BaseModel):
    broken_html: str = Field(..., min_length=1, description="The broken HTML snippet to fix")
    rule_id: str = Field(..., min_length=1, description="The WCAG rule_id to look up remediation context")


class RemediateResponse(BaseModel):
    corrected_html: str
    rule_id: str
    model_used: str = ""


# ─── Error ────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
