# Iteration 3: new detection scenarios (AR, AP, SaaS, processing, royalty) + ingest for new domains
import os
import uuid
from datetime import date, timedelta
import pytest
import requests
from conftest import BASE_URL as B

TAG = uuid.uuid4().hex[:6]
S = {}
NEW = ["AR_RECEIVABLE", "AP_PAYMENT", "SAAS_LICENSE", "PAYMENT_PROCESSING", "ROYALTY"]


def _db():
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    db = _db()
    cp = S.get("cp")
    if cp:
        n = db.cases.delete_many({"counterparty_id": cp}).deleted_count
        db.transactions.delete_many({"counterparty_id": cp})
        db.batches.delete_many({"counterparty_id": cp})
        db.rules.delete_many({"counterparty_id": cp})
        db.counterparties.delete_one({"id": cp})
        print(f"cleanup: removed cp {cp}, {n} cases")


# ---- domains catalogue ----
def test_domains_catalogue(c):
    d = c["viewer_cfo"].get(B + "/api/domains").json()
    assert len(d) == 10
    groups = {x["group"] for x in d}
    assert groups == {"Partner & channel", "Procurement & payables", "Revenue & receivables"}
    assert all(x["desc"] and x["label"] for x in d)
    for k in NEW:
        assert k in {x["key"] for x in d}


@pytest.mark.parametrize("dom", NEW)
def test_templates_new_domains(c, dom):
    r = c["analyst"].get(B + f"/api/templates/{dom}")
    assert r.status_code == 200
    cols = r.text.splitlines()[0].split(",")
    dd = {x["key"]: x for x in c["analyst"].get(B + "/api/domains").json()}
    assert cols == dd[dom]["columns"]


# ---- seeded cases per new domain ----
EXPECT = {
    "AR_RECEIVABLE": {"SHORT_PAYMENT", "UNPAID_OVERDUE", "UNEARNED_DISCOUNT", "LATE_INTEREST"},
    "AP_PAYMENT": {"OVERPAYMENT", "DUPLICATE_BILLING"},
    "SAAS_LICENSE": {"SEAT_OVERBILLING"},
    "PAYMENT_PROCESSING": {"PROCESSING_OVERCHARGE"},
    "ROYALTY": {"ROYALTY_SHORTFALL"},
}
CPS = {"AR_RECEIVABLE": {"Northwind Retail Group", "Brightline Distributors"}, "AP_PAYMENT": {"Apex Packaging"},
       "SAAS_LICENSE": {"CloudSuite CRM"}, "PAYMENT_PROCESSING": {"PayStream"}, "ROYALTY": {"Lumen Brands"}}


@pytest.mark.parametrize("dom", NEW)
def test_seeded_cases(c, dom):
    cases = [x for x in c["admin"].get(B + f"/api/cases?domain={dom}").json() if not x["ref"].startswith("TEST_")]
    assert cases, f"no seeded cases for {dom}"
    types = {x["leak_type"] for x in cases}
    missing = EXPECT[dom] - types
    assert not missing, f"{dom} missing leak types {missing}; got {types}"
    names = {x["counterparty_name"] for x in cases}
    assert any(any(n.startswith(cp.split()[0]) for n in names) for cp in CPS[dom]), names
    # math: leak_amount equals sum of positive variances (over) / negative (under) of lines
    for cs in cases[:5]:
        d = c["admin"].get(B + f"/api/cases/{cs['id']}").json()
        lines = d["lines"]
        assert lines
        if d["leak_type"] == "DUPLICATE_BILLING":
            assert abs(d["leak_amount"] - lines[0]["actual"]) < 0.02
            continue
        total = 0
        for ln in lines:
            assert abs(ln["variance"] - round(ln["actual"] - ln["expected"], 2)) < 0.02
            if ln["dir"] == "under" and ln["variance"] < 0:
                total += -ln["variance"]
            elif ln["dir"] == "over" and ln["variance"] > 0:
                total += ln["variance"]
        assert abs(total - d["leak_amount"]) < 0.05, (d["number"], d["leak_type"], lines, d["leak_amount"])


# ---- ingest AR CSV on TEST_ counterparty ----
def test_ar_ingest_flow(c):
    cp = c["admin"].post(B + "/api/counterparties", json={"name": f"TEST_Customer_{TAG}", "type": "CUSTOMER",
                                                          "contact_email": "delivered@resend.dev"}).json()
    S["cp"] = cp["id"]
    terms = {"payment_terms_days": 30, "early_pay_discount_pct": 2.0, "discount_days": 10,
             "late_interest_pct_per_month": 1.5, "tolerance_amount": 5.0, "dispute_window_days": 365}
    rule = c["rule_author"].post(B + "/api/rules", json={"name": "TEST_AR terms", "counterparty_id": cp["id"],
                                 "domain": "AR_RECEIVABLE", "effective_from": "2025-01-01", "effective_to": "2027-12-31",
                                 "terms": terms}).json()
    assert c["rule_author"].post(B + f"/api/rules/{rule['id']}/publish").status_code == 200
    d0 = date.today() - timedelta(days=90)
    due = d0 + timedelta(days=30)
    paid_on_time = d0 + timedelta(days=20)
    csv = ("invoice_no,date,due_date,invoice_amount,credit_notes,amount_paid,payment_date\n"
           f"TEST_AR-{TAG}-1,{d0},{due},10000,0,9000,{paid_on_time}\n"   # short pay 1000
           f"TEST_AR-{TAG}-2,{d0},{due},5000,,,\n"                        # unpaid overdue
           f"TEST_AR-{TAG}-3,{d0},{due},8000,0,8000,{paid_on_time}\n"     # clean
           f"TEST_AR-{TAG}-4,{d0},{due},10000,0,9800,{paid_on_time}\n")   # paid in window? 20d>10d => unearned disc
    r = c["analyst"].post(B + "/api/ingest", files={"file": ("TEST_ar.csv", csv.encode())},
                          data={"domain": "AR_RECEIVABLE", "counterparty_id": cp["id"]})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["inserted"] == 4, b
    cases = {x["ref"]: x for x in c["analyst"].get(B + f"/api/cases?counterparty_id={cp['id']}").json()}
    print({k: (v["leak_type"], v["leak_amount"]) for k, v in cases.items()})
    c1 = cases[f"TEST_AR-{TAG}-1"]
    assert c1["leak_type"] == "SHORT_PAYMENT" and abs(c1["leak_amount"] - 1000) < 0.01
    c2 = cases[f"TEST_AR-{TAG}-2"]
    assert c2["leak_type"] == "UNPAID_OVERDUE"
    days = (date.today() - due).days
    exp = 5000 + 5000 * 1.5 / 100 * days / 30
    assert abs(c2["leak_amount"] - round(exp, 2)) < 1, (c2["leak_amount"], exp)
    assert f"TEST_AR-{TAG}-3" not in cases
    c4 = cases[f"TEST_AR-{TAG}-4"]
    assert c4["leak_type"] == "UNEARNED_DISCOUNT" and abs(c4["leak_amount"] - 200) < 0.01
    S["ar_case"] = c1["id"]


def test_ap_duplicate_ingest(c):
    cp = S["cp"]
    csv = ("payment_id,date,vendor_invoice_no,invoice_amount,amount_paid\n"
           f"TEST_PAY-{TAG}-1,2026-09-03,TEST_VI-{TAG},1000,1000\n"
           f"TEST_PAY-{TAG}-2,2026-09-20,TEST_VI-{TAG},1000,1000\n"
           f"TEST_PAY-{TAG}-3,2026-09-21,TEST_VI2-{TAG},2000,2300\n")
    # no AP rule -> duplicate still flagged, overpayment needs rule
    rule = c["rule_author"].post(B + "/api/rules", json={"name": "TEST_AP", "counterparty_id": cp, "domain": "AP_PAYMENT",
                                 "effective_from": "2025-01-01", "effective_to": "2027-12-31",
                                 "terms": {"tolerance_amount": 1.0, "dispute_window_days": 365}}).json()
    c["rule_author"].post(B + f"/api/rules/{rule['id']}/publish")
    r = c["analyst"].post(B + "/api/ingest", files={"file": ("TEST_ap.csv", csv.encode())},
                          data={"domain": "AP_PAYMENT", "counterparty_id": cp})
    assert r.status_code == 200, r.text
    cases = {x["ref"]: x for x in c["analyst"].get(B + f"/api/cases?counterparty_id={cp}&domain=AP_PAYMENT").json()}
    assert f"TEST_PAY-{TAG}-1" not in cases
    assert cases[f"TEST_PAY-{TAG}-2"]["leak_type"] == "DUPLICATE_BILLING" and cases[f"TEST_PAY-{TAG}-2"]["leak_amount"] == 1000
    assert cases[f"TEST_PAY-{TAG}-3"]["leak_type"] == "OVERPAYMENT" and cases[f"TEST_PAY-{TAG}-3"]["leak_amount"] == 300


def test_scenario_stats_in_dashboard(c):
    d = c["viewer_cfo"].get(B + "/api/dashboard").json()
    doms = {x["domain"] for x in d["by_domain"]}
    for k in NEW:
        assert k in doms, f"{k} missing from dashboard by_domain"


def test_ar_case_ai_draft(c):
    import json
    r = c["analyst"].post(B + f"/api/ai/cases/{S['ar_case']}/draft", stream=True, timeout=150)
    ev = [json.loads(l[6:]) for l in r.iter_lines(decode_unicode=True) if l and l.startswith("data: ")]
    assert not any("error" in e for e in ev), ev[-1]
    text = "".join(e.get("delta", "") for e in ev)
    print(text[:600])
    assert any(e.get("done") for e in ev)
    assert "1,000" in text or "1000" in text
