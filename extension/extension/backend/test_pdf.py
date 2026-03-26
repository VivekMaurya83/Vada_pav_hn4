import httpx
p = {
    "url": "https://example.com",
    "score": 50,
    "total_issues": 3,
    "issues": [
        {"rule_id": "wcag_1_1_1", "axe_rule_id": "image-alt", "impact": "critical",
         "description": "Images must have alternate text", "html_snippet": "<img src='photo.jpg'>",
         "failure_summary": "Element does not have an alt attribute",
         "css_selector": "img", "is_incomplete": False},
        {"rule_id": "wcag_1_3_1", "axe_rule_id": "heading-order", "impact": "moderate",
         "description": "Heading levels should only increase by one",
         "html_snippet": "<h3>Skipped heading level</h3>",
         "css_selector": "h3", "is_incomplete": False},
        {"rule_id": "wcag_4_1_2", "axe_rule_id": "button-name", "impact": "critical",
         "description": "Buttons must have discernible text",
         "html_snippet": "<button class='submit-btn'></button>",
         "failure_summary": "Element does not have inner text or aria-label",
         "css_selector": "button.submit-btn", "is_incomplete": False},
    ],
    "scanned_at": "2026-03-25T22:00:00Z",
}
print("Requesting PDF...")
r = httpx.post("http://localhost:8000/api/report/pdf", json=p, timeout=120)
print(f"Status: {r.status_code}, Size: {len(r.content)} bytes")
if r.status_code == 200:
    with open("test_output.pdf", "wb") as f:
        f.write(r.content)
    print("Saved to test_output.pdf")
else:
    print(f"Error: {r.text[:500]}")
