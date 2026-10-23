import ipaddress
import logging
import os
import re
from datetime import datetime, timedelta
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from core import db, now_iso, new_id, audit
from engine import evaluate, severity, DOMAINS

logger = logging.getLogger(__name__)

# ---------------- detection ----------------

async def next_case_number() -> str:
    c = await db.counters.find_one_and_update({"id": "case"}, {"$inc": {"n": 1}}, upsert=True, return_document=True)
    return f"LK-{1000 + c['n']}"


async def active_rule(counterparty_id: str, domain: str, date: str):
    return await db.rules.find_one(
        {"counterparty_id": counterparty_id, "domain": domain, "status": "PUBLISHED",
         "effective_from": {"$lte": date[:10]}, "effective_to": {"$gte": date[:10]}},
        {"_id": 0}, sort=[("version", -1)])


def dup_key(domain: str, row: dict):
    if domain == "FREIGHT":
        return str(row.get("shipment_id") or "")
    if domain == "PRICE_VARIANCE":
        return f"{row.get('sku')}|{row.get('qty')}|{str(row.get('date'))[:10]}"
    if domain == "RETAIL_DEDUCTION":
        return f"{row.get('po_number')}|{row.get('reason_code')}"
    if domain == "AP_PAYMENT":
        return str(row.get("vendor_invoice_no") or "")
    return None


async def run_detection(member: dict | None, batch_id: str | None = None) -> dict:
    q = {"evaluated": False}
    if batch_id:
        q["batch_id"] = batch_id
    txns = await db.transactions.find(q, {"_id": 0}).sort("seq", 1).to_list(20000)
    stats = {"evaluated": 0, "leaks": 0, "no_rule": 0, "clean": 0, "amount": 0.0}
    for t in txns:
        stats["evaluated"] += 1
        rule = await active_rule(t["counterparty_id"], t["domain"], t["date"])
        dup = bool(t.get("duplicate_of"))
        if not rule and not dup:
            stats["no_rule"] += 1
            await db.transactions.update_one({"id": t["id"]}, {"$set": {"evaluated": True, "result": "NO_RULE"}})
            continue
        finding = evaluate(t, rule["terms"] if rule else {}, duplicate=dup)
        if not finding:
            stats["clean"] += 1
            await db.transactions.update_one({"id": t["id"]}, {"$set": {"evaluated": True, "result": "MATCHED",
                                                                       "rule_version": rule["version"]}})
            continue
        recheck = evaluate(t, rule["terms"] if rule else {}, duplicate=dup)
        window_days = int((rule or {}).get("terms", {}).get("dispute_window_days", 90))
        window_end = (datetime.fromisoformat(t["date"][:10]) + timedelta(days=window_days)).date().isoformat()
        case = {
            "id": new_id("case_"), "number": await next_case_number(), "txn_id": t["id"], "ref": t["ref"],
            "domain": t["domain"], "leak_type": finding["leak_type"], "counterparty_id": t["counterparty_id"],
            "counterparty_name": t["counterparty_name"], "txn_date": t["date"][:10],
            "charged_amount": round(sum(ln["actual"] for ln in finding["lines"]), 2),
            "leak_amount": finding["leak"], "lines": finding["lines"], "reason": finding["reason"],
            "clause": finding["clause"], "rule_id": rule["id"] if rule else None,
            "rule_version": rule["version"] if rule else None,
            "rule_name": rule["name"] if rule else "Duplicate payment control",
            "source_ref": rule.get("source_ref") if rule else "", "confidence": finding["confidence"],
            "severity": severity(finding["leak"]), "status": "OPEN", "assignee_id": None, "assignee_name": None,
            "currency": t.get("currency", "USD"), "window_ends_at": window_end, "recovered_amount": 0.0,
            "assurance": {"auto": "CONFIRM" if recheck and recheck["leak"] == finding["leak"] else "DISAGREE",
                          "verdict": None, "by": None, "note": "", "at": None},
            "draft": None, "emails": [], "comments": [], "batch_id": t.get("batch_id"),
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.cases.insert_one({**case})
        await db.transactions.update_one({"id": t["id"]}, {"$set": {"evaluated": True, "result": "LEAK",
                                                                   "case_id": case["id"]}})
        await audit(member, "case.detected", "case", case["id"],
                    f"{case['number']} {finding['leak_type']} {finding['leak']:.2f} on {t['ref']}")
        stats["leaks"] += 1
        stats["amount"] += finding["leak"]
    stats["amount"] = round(stats["amount"], 2)
    return stats


async def insert_transactions(rows: list, domain: str, cp: dict, batch_id: str) -> dict:
    ref_col = DOMAINS[domain]["ref"]
    inserted, skipped = 0, 0
    seq = await db.transactions.count_documents({})
    for row in rows:
        row = {k: (None if v != v else v) for k, v in row.items()}  # NaN -> None
        row_hash = "|".join(str(row.get(c)) for c in DOMAINS[domain]["columns"])
        if await db.transactions.find_one({"counterparty_id": cp["id"], "domain": domain, "row_hash": row_hash}):
            skipped += 1
            continue
        key = dup_key(domain, row)
        dup_of = None
        if key:
            prev = await db.transactions.find_one({"counterparty_id": cp["id"], "domain": domain, "dup_key": key}, {"_id": 0, "id": 1})
            dup_of = prev["id"] if prev else None
        seq += 1
        await db.transactions.insert_one({
            **{c: row.get(c) for c in DOMAINS[domain]["columns"]},
            "id": new_id("txn_"), "seq": seq, "domain": domain, "ref": str(row.get(ref_col)),
            "date": str(row.get("date"))[:10], "counterparty_id": cp["id"], "counterparty_name": cp["name"],
            "currency": cp.get("currency", "USD"), "batch_id": batch_id, "row_hash": row_hash,
            "dup_key": key, "duplicate_of": dup_of, "evaluated": False, "result": None, "created_at": now_iso(),
        })
        inserted += 1
    return {"inserted": inserted, "skipped": skipped}


# ---------------- email (Emergent managed) ----------------

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    try:
        _assert_safe_email(subject, html)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Email blocked by safety check: {e}")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code}): {e.response.text}")
            raise HTTPException(status_code=503, detail="Email is temporarily unavailable")
        if code == "rate_limited" or e.response.status_code == 429:
            raise HTTPException(status_code=429, detail="Email rate limit reached — try again in a minute")
        if code == "undeliverable_recipient":
            raise HTTPException(status_code=422, detail=f"Recipient {to} looks undeliverable — update the dispute contact email in Team & Settings → Counterparties")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


def text_to_email_html(body: str, footer_note: str) -> str:
    paras = "".join(f'<p style="margin:0 0 12px 0">{escape(p).replace(chr(10), "<br>")}</p>'
                    for p in body.strip().split("\n\n") if p.strip())
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px;'
            f'font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.55">{paras}'
            f'<p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px">'
            f'{escape(footer_note)} Sent via {escape(EMAIL_FROM_NAME)}. We never ask for passwords or payment card details by email.</p>'
            f'</td></tr></table>')
