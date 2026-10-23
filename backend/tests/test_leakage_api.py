# Leakage & Recovery API regression: auth, role caps, rules, ingest, case workflow, admin
import io
import json
import time
import uuid
import pytest
import requests
from conftest import BASE_URL as B

STATE = {}
TAG = uuid.uuid4().hex[:6]


# ---------- auth ----------
def test_401_without_token():
    for p in ["/api/cases", "/api/dashboard", "/api/me", "/api/users"]:
        assert requests.get(B + p).status_code == 401, p


def test_me_roles(c):
    for r in c:
        d = c[r].get(B + "/api/me").json()
        assert d["role"] == r
        assert isinstance(d["caps"], list)


# ---------- role caps ----------
def test_caps_forbidden(c):
    assert c["analyst"].get(B + "/api/users").status_code == 403
    assert c["viewer_cfo"].post(B + "/api/counterparties", json={"name": "TEST_x"}).status_code == 403
    files = {"file": ("x.csv", b"a,b\n1,2\n")}
    r = c["viewer_cfo"].post(B + "/api/ingest", files=files, data={"domain": "FREIGHT", "counterparty_id": "cp_expresscomm"})
    assert r.status_code == 403
    assert c["analyst"].post(B + "/api/rules", json={}).status_code in (403, 422)
    # analyst approve -> 403 on any case
    cid = c["admin"].get(B + "/api/cases?status=ESCALATED").json()[0]["id"]
    assert c["analyst"].post(B + f"/api/cases/{cid}/action", json={"action": "approve"}).status_code == 403
    assert c["viewer_cfo"].post(B + f"/api/cases/{cid}/send", json={"kind": "claim"}).status_code == 403
    assert c["analyst"].post(B + f"/api/cases/{cid}/send", json={"kind": "claim"}).status_code == 403
    assert c["analyst"].post(B + f"/api/cases/{cid}/assurance", json={"verdict": "CONFIRM"}).status_code == 403


# ---------- setup: counterparty (admin) ----------
def test_create_counterparty(c):
    body = {"name": f"TEST_Freight_{TAG}", "type": "CARRIER", "contact_name": "TEST Billing",
            "contact_email": "delivered@resend.dev", "currency": "USD"}
    r = c["admin"].post(B + "/api/counterparties", json=body)
    assert r.status_code == 200
    cp = r.json()
    STATE["cp"] = cp["id"]
    assert any(x["id"] == cp["id"] for x in c["admin"].get(B + "/api/counterparties").json())
    body["notes"] = "edited"
    r = c["admin"].put(B + f"/api/counterparties/{cp['id']}", json=body)
    assert r.status_code == 200 and r.json()["notes"] == "edited"


# ---------- truth layer ----------
def test_rule_create_edit_publish(c):
    terms = {"rate_per_kg": 1.10, "fuel_surcharge_pct": 12.0, "min_charge": 150.0, "max_accessorial": 50.0,
             "tolerance_amount": 1.0, "dispute_window_days": 90}
    rule = {"name": "TEST_rule v1", "counterparty_id": STATE["cp"], "domain": "FREIGHT",
            "effective_from": "2025-01-01", "effective_to": "2027-12-31", "clause_text": "TEST clause", "terms": terms}
    r = c["rule_author"].post(B + "/api/rules", json=rule)
    assert r.status_code == 200, r.text
    r1 = r.json()
    assert r1["status"] == "DRAFT" and r1["version"] == 1
    rule["name"] = "TEST_rule v1 edited"
    r = c["rule_author"].put(B + f"/api/rules/{r1['id']}", json=rule)
    assert r.json()["name"] == "TEST_rule v1 edited"
    assert c["rule_author"].post(B + f"/api/rules/{r1['id']}/publish").status_code == 200
    # v2 publish retires v1
    rule["name"] = "TEST_rule v2"
    r2 = c["rule_author"].post(B + "/api/rules", json=rule).json()
    assert r2["version"] == 2
    assert c["rule_author"].post(B + f"/api/rules/{r2['id']}/publish").status_code == 200
    rules = {x["id"]: x for x in c["admin"].get(B + "/api/rules").json()}
    assert rules[r1["id"]]["status"] == "RETIRED"
    assert rules[r2["id"]]["status"] == "PUBLISHED"
    # bad dates
    rule["effective_from"] = "2028-01-01"
    assert c["rule_author"].post(B + "/api/rules", json=rule).status_code == 400


# ---------- ingest ----------
CSV = (
    "invoice_no,date,shipment_id,origin,destination,weight_kg,billed_amount,accessorial_charged\n"
    f"TEST_FRT-{TAG}-1,2026-09-08,TEST_SHP-{TAG}-1,Dallas,Chicago,1000,1500,40\n"
    f"TEST_FRT-{TAG}-2,2026-09-09,TEST_SHP-{TAG}-2,Dallas,Austin,1000,8000,40\n"
    f"TEST_FRT-{TAG}-3,2026-09-10,TEST_SHP-{TAG}-3,Dallas,Austin,1000,1232,40\n"
)


def test_template_download(c):
    r = c["analyst"].get(B + "/api/templates/FREIGHT")
    assert r.status_code == 200 and r.text.startswith("invoice_no,date")


def test_ingest_and_detect(c):
    r = c["analyst"].post(B + "/api/ingest", files={"file": ("TEST_frt.csv", CSV.encode())},
                          data={"domain": "FREIGHT", "counterparty_id": STATE["cp"]})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["inserted"] == 3 and b["skipped"] == 0
    assert b["detection"]["leaks"] >= 2, b
    cases = c["analyst"].get(B + f"/api/cases?counterparty_id={STATE['cp']}").json()
    by_ref = {x["ref"]: x for x in cases}
    STATE["small"] = by_ref[f"TEST_FRT-{TAG}-1"]["id"]
    STATE["big"] = by_ref[f"TEST_FRT-{TAG}-2"]["id"]
    assert by_ref[f"TEST_FRT-{TAG}-2"]["leak_amount"] >= 5000
    # re-upload -> all skipped
    r = c["analyst"].post(B + "/api/ingest", files={"file": ("TEST_frt.csv", CSV.encode())},
                          data={"domain": "FREIGHT", "counterparty_id": STATE["cp"]})
    assert r.json()["inserted"] == 0 and r.json()["skipped"] == 3


def test_ingest_missing_cols(c):
    r = c["analyst"].post(B + "/api/ingest", files={"file": ("TEST_bad.csv", b"invoice_no,date\nX,2026-01-01\n")},
                          data={"domain": "FREIGHT", "counterparty_id": STATE["cp"]})
    assert r.status_code == 422 and "Missing" in r.json()["detail"]


# ---------- list filters / export ----------
def test_list_filters_export(c):
    a = c["admin"]
    assert all(x["status"] == "OPEN" for x in a.get(B + "/api/cases?status=OPEN").json())
    assert all(x["domain"] == "FREIGHT" for x in a.get(B + "/api/cases?domain=FREIGHT").json())
    assert all(x["severity"] == "HIGH" for x in a.get(B + "/api/cases?severity=HIGH").json())
    assert len(a.get(B + f"/api/cases?q=TEST_FRT-{TAG}").json()) >= 2
    r = a.get(B + "/api/cases/export.csv")
    assert r.status_code == 200 and r.text.startswith("number,status")


def test_search_regex_special_chars(c):
    r = c["admin"].get(B + "/api/cases", params={"q": "("})
    assert r.status_code == 200, f"search '(' -> {r.status_code}"


# ---------- workflow ----------
def test_escalate_approve_flow(c):
    team = {m["role"]: m["user_id"] for m in c["admin"].get(B + "/api/team").json()}
    STATE["team"] = team
    cid = STATE["small"]
    # escalating to an analyst should be rejected
    r = c["analyst"].post(B + f"/api/cases/{cid}/action", json={"action": "escalate", "assignee_id": team["analyst"]})
    assert r.status_code == 400
    before = c["approver"].get(B + "/api/notifications").json()["unread"]
    r = c["analyst"].post(B + f"/api/cases/{cid}/action",
                          json={"action": "escalate", "assignee_id": team["approver"], "note": "TEST_ please approve"})
    assert r.status_code == 200 and r.json()["status"] == "ESCALATED"
    n = c["approver"].get(B + "/api/notifications").json()
    assert n["unread"] == before + 1
    assert c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "approve"}).json()["status"] == "APPROVED"


def test_dual_control(c):
    cid = STATE["big"]
    assert c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "start_review"}).json()["status"] == "IN_REVIEW"
    r = c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "approve"})
    assert r.status_code == 409
    r = c["assurance"].post(B + f"/api/cases/{cid}/assurance", json={"verdict": "CONFIRM", "note": "TEST_ ok"})
    assert r.status_code == 200 and r.json()["assurance"]["verdict"] == "CONFIRM"
    assert c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "approve"}).json()["status"] == "APPROVED"


def test_comment_and_draft(c):
    cid = STATE["small"]
    r = c["analyst"].post(B + f"/api/cases/{cid}/comments", json={"text": "TEST_ comment"})
    assert r.status_code == 200
    assert c["viewer_cfo"].post(B + f"/api/cases/{cid}/comments", json={"text": "TEST_ cfo comment"}).status_code == 200
    r = c["analyst"].put(B + f"/api/cases/{cid}/draft", json={"subject": "TEST_ claim", "body": "Hello,\n\nPlease credit TEST amount.\n\nThanks"})
    assert r.status_code == 200
    d = c["analyst"].get(B + f"/api/cases/{cid}").json()
    assert d["draft"]["subject"] == "TEST_ claim" and len(d["comments"]) >= 2
    assert any(h["action"] == "case.comment" for h in d["history"])


def test_send_claim(c):
    cid = STATE["small"]
    big = STATE["big"]
    # big has no draft
    assert c["approver"].post(B + f"/api/cases/{big}/send", json={"kind": "claim"}).status_code == 400
    r = c["approver"].post(B + f"/api/cases/{cid}/send", json={"kind": "claim"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "CLAIM_SENT" and len(r.json()["emails"]) == 1


def test_recovery_transitions(c):
    cid = STATE["small"]
    case = c["approver"].get(B + f"/api/cases/{cid}").json()
    amt = case["leak_amount"]
    assert c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "record_recovery", "amount": 0}).status_code == 400
    r = c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "record_recovery", "amount": round(amt / 2, 2)})
    assert r.json()["status"] == "PARTIALLY_RECOVERED"
    r = c["approver"].post(B + f"/api/cases/{cid}/action", json={"action": "record_recovery", "amount": round(amt - round(amt / 2, 2), 2)})
    assert r.json()["status"] == "RECOVERED"
    # big: write off -> reopen -> dismiss (needs note)
    big = STATE["big"]
    assert c["approver"].post(B + f"/api/cases/{big}/action", json={"action": "write_off", "note": "TEST_"}).json()["status"] == "WRITTEN_OFF"
    assert c["analyst"].post(B + f"/api/cases/{big}/action", json={"action": "reopen"}).json()["status"] == "IN_REVIEW"
    assert c["approver"].post(B + f"/api/cases/{big}/action", json={"action": "dismiss"}).status_code == 400
    assert c["approver"].post(B + f"/api/cases/{big}/action", json={"action": "dismiss", "note": "TEST_ dup"}).json()["status"] == "DISMISSED"
    assert c["approver"].post(B + f"/api/cases/{big}/action", json={"action": "approve"}).status_code == 409


def test_mark_denied_and_send_undeliverable(c):
    # big: reopen -> approve (assurance confirmed) -> send blocked? (resend ok) -> denied
    big = STATE["big"]
    c["analyst"].post(B + f"/api/cases/{big}/action", json={"action": "reopen"})
    assert c["approver"].post(B + f"/api/cases/{big}/action", json={"action": "approve"}).json()["status"] == "APPROVED"
    c["approver"].put(B + f"/api/cases/{big}/draft", json={"subject": "TEST_ big", "body": "TEST body"})
    r = c["approver"].post(B + f"/api/cases/{big}/send", json={"kind": "claim"})
    assert r.status_code == 200, r.text
    r = c["approver"].post(B + f"/api/cases/{big}/action", json={"action": "mark_denied", "note": "TEST_"})
    assert r.json()["status"] == "DENIED"


# ---------- dashboard / audit / pipeline data ----------
def test_dashboard_and_audit(c):
    d = c["viewer_cfo"].get(B + "/api/dashboard").json()
    for k in ["kpis", "by_domain", "by_counterparty", "trend", "status_counts", "expiring", "my_queue"]:
        assert k in d
    assert d["kpis"]["identified"] > 0
    a = c["viewer_cfo"].get(B + "/api/audit").json()
    assert len(a) > 0 and "action" in a[0]


# ---------- admin ----------
def test_admin_roles_settings(c):
    team = STATE["team"]
    r = c["admin"].patch(B + f"/api/users/{team['admin']}/role", json={"role": "analyst"})
    # Only one admin in preview env? -> expect 409; if more admins exist, revert
    if r.status_code == 200:
        c["admin"].patch(B + f"/api/users/{team['admin']}/role", json={"role": "admin"})
        pytest.fail("Admin demoted though expected 409 (maybe multiple admins exist)")
    assert r.status_code == 409
    assert c["approver"].patch(B + f"/api/users/{team['analyst']}/role", json={"role": "admin"}).status_code == 403
    s = c["admin"].get(B + "/api/settings").json()
    s2 = {k: s[k] for k in ["dual_approval_threshold", "expiring_window_days", "company_name", "auto_detect_on_upload"]}
    r = c["admin"].put(B + "/api/settings", json={**s2, "expiring_window_days": s2["expiring_window_days"] + 1})
    assert r.json()["expiring_window_days"] == s2["expiring_window_days"] + 1
    c["admin"].put(B + "/api/settings", json=s2)


# ---------- AI ----------
def _sse(resp):
    events = []
    for line in resp.iter_lines(decode_unicode=True):
        if line and line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


def test_ai_draft_stream(c):
    r = c["analyst"].post(B + f"/api/ai/cases/{STATE['small']}/draft", stream=True, timeout=120)
    ev = _sse(r)
    assert not any("error" in e for e in ev), ev[-1]
    assert any(e.get("done") for e in ev) and sum(1 for e in ev if "delta" in e) > 1


def test_ai_extract_rule(c):
    text = ("Carrier shall bill at USD 1.25 per kg with a fuel surcharge of 10 percent. Accessorial charges are capped "
            "at USD 40 per shipment. Disputes must be raised within 60 days.")
    r = c["rule_author"].post(B + "/api/ai/extract-rule", json={"domain": "FREIGHT", "text": text}, timeout=120)
    assert r.status_code == 200, r.text
    t = r.json()["terms"]
    assert float(t["rate_per_kg"]) == 1.25 and float(t["dispute_window_days"]) == 60


def test_copilot(c):
    c["viewer_cfo"].delete(B + "/api/ai/copilot/history")
    r = c["viewer_cfo"].post(B + "/api/ai/copilot", json={"question": "Top counterparty by identified leakage?"}, stream=True, timeout=120)
    ev = _sse(r)
    assert any(e.get("done") for e in ev), ev[-1:]
    h = c["viewer_cfo"].get(B + "/api/ai/copilot/history").json()
    assert len(h) == 2
    c["viewer_cfo"].delete(B + "/api/ai/copilot/history")
    assert c["viewer_cfo"].get(B + "/api/ai/copilot/history").json() == []
