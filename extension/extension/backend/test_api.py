"""Quick smoke test for the API."""
import httpx

# Test GET /api/rules
r = httpx.get("http://localhost:8000/api/rules")
print(f"GET /api/rules => Status: {r.status_code}")
data = r.json()
rules = data.get("wcag_dictionary", [])
print(f"  Rules count: {len(rules)}")
if rules:
    print(f"  First rule: {rules[0]['rule_id']}")
    print(f"  Last rule:  {rules[-1]['rule_id']}")
print()

# Test POST /api/scan with invalid URL (should get 422)
r2 = httpx.post("http://localhost:8000/api/scan", json={"url": "not-a-url"})
print(f"POST /api/scan (bad url) => Status: {r2.status_code}")
print()

# Test POST /api/remediate with unknown rule (should get 404)
r3 = httpx.post("http://localhost:8000/api/remediate", json={"broken_html": "<img>", "rule_id": "fake_rule"})
print(f"POST /api/remediate (bad rule) => Status: {r3.status_code}")
print(f"  Detail: {r3.json().get('detail', '')}")

print("\nAll smoke tests passed!")
