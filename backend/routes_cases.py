import csv
import io
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import db, now_iso, new_id, audit, notify, require_cap, get_settings, ESCALATION_ROLES, ACTIVE, ROLE_LABELS
from services import send_email, text_to_email_html

router = APIRouter(prefix="/api")

OPEN_SET = ["OPEN", "IN_REVIEW", "ESCALATED", "APPROVED"]
CLAIM_SET = ["CLAIM_SENT", "PARTIALLY_RECOVERED"]
ACTIONS = {
    "start_review": ("work_case", ["OPEN"], "IN_REVIEW"),
    "escalate": ("assign", ["OPEN", "IN_REVIEW", "DENIED"], "ESCALATED"),
    "assign": ("assign", OPEN_SET + CLAIM_SET + ["DENIED"], None),
    "approve": ("approve", ["IN_REVIEW", "ESCALATED"], "APPROVED"),
    "dismiss": ("approve", ["OPEN", "IN_REVIEW", "ESCALATED"], "DISMISSED"),
    "record_recovery": ("record_recovery", CLAIM_SET, None),
    "mark_denied": ("record_recovery", ["CLAIM_SENT"], "DENIED"),
    "write_off": ("write_off", ["IN_REVIEW", "ESCALATED", "APPROVED", "CLAIM_SENT", "PARTIALLY_RECOVERED", "DENIED"], "WRITTEN_OFF"),
    "reopen": ("work_case", ["DISMISSED", "DENIED", "WRITTEN_OFF"], "IN_REVIEW"),
}
P = "_id"


async def _case(case_id: str) -> dict:
    c = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Case not found")
    return c


@router.get("/cases")
async def list_cases(status: str = "", domain: str = "", counterparty_id: str = "", assignee: str = "",
                     severity: str = "", q: str = "", expiring: bool = False, sort: str = "-created_at",
                     limit: int = 500, member: dict = Depends(require_cap("read"))):
    f = {}
    if status:
        f["status"] = {"$in": status.split(",")}
    if domain:
        f["domain"] = domain
    if counterparty_id:
        f["counterparty_id"] = counterparty_id
    if severity:
        f["severity"] = severity
    if assignee == "me":
        f["assignee_id"] = member["user_id"]
    elif assignee == "unassigned":
        f["assignee_id"] = None
    if q:
        rq = re.escape(q)
        f["$or"] = [{"number": {"$regex": rq, "$options": "i"}}, {"ref": {"$regex": rq, "$options": "i"}},
                    {"counterparty_name": {"$regex": rq, "$options": "i"}}]
    if expiring:
        s = await get_settings()
        from datetime import date, timedelta
        f["window_ends_at"] = {"$lte": (date.today() + timedelta(days=s["expiring_window_days"])).isoformat()}
        f["status"] = {"$in": OPEN_SET}
    key, direction = (sort[1:], -1) if sort.startswith("-") else (sort, 1)
    return await db.cases.find(f, {"_id": 0, "lines": 0, "comments": 0, "emails": 0, "draft": 0}).sort(key, direction).to_list(limit)


@router.get("/cases/export.csv")
async def export_cases(member: dict = Depends(require_cap("read"))):
    rows = await db.cases.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    cols = ["number", "status", "domain", "leak_type", "counterparty_name", "ref", "txn_date", "charged_amount",
            "leak_amount", "recovered_amount", "confidence", "severity", "assignee_name", "window_ends_at", "reason"]
    w.writerow(cols)
    for r in rows:
        w.writerow([r.get(c, "") for c in cols])
    await audit(member, "cases.exported", "case", "*", f"{len(rows)} rows")
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=leakage-cases.csv"})


@router.get("/cases/{case_id}")
async def get_case(case_id: str, member: dict = Depends(require_cap("read"))):
    c = await _case(case_id)
    c["transaction"] = await db.transactions.find_one({"id": c["txn_id"]}, {"_id": 0, "row_hash": 0})
    c["counterparty"] = await db.counterparties.find_one({"id": c["counterparty_id"]}, {"_id": 0})
    c["rule"] = await db.rules.find_one({"id": c["rule_id"]}, {"_id": 0}) if c.get("rule_id") else None
    c["history"] = await db.audit.find({"entity": "case", "entity_id": case_id}, {"_id": 0}).sort("ts", -1).to_list(200)
    s = await get_settings()
    c["needs_dual_control"] = c["leak_amount"] >= s["dual_approval_threshold"]
    c["dual_approval_threshold"] = s["dual_approval_threshold"]
    return c


class ActionIn(BaseModel):
    action: str
    note: str = ""
    assignee_id: str | None = None
    amount: float | None = None


@router.post("/cases/{case_id}/action")
async def case_action(case_id: str, body: ActionIn, member: dict = Depends(require_cap("read"))):
    if body.action not in ACTIONS:
        raise HTTPException(400, "Unknown action")
    cap, allowed_from, to = ACTIONS[body.action]
    from core import CAPS
    if member["role"] not in CAPS[cap]:
        raise HTTPException(403, "Your role does not allow this action")
    c = await _case(case_id)
    if c["status"] not in allowed_from:
        raise HTTPException(409, f"Cannot {body.action.replace('_', ' ')} a case in status {c['status']}")
    upd = {"updated_at": now_iso()}
    detail = body.note
    if body.action in ("escalate", "assign"):
        if not body.assignee_id:
            raise HTTPException(400, "Choose who to assign this to")
        target = await db.users.find_one({"user_id": body.assignee_id}, {"_id": 0})
        if not target or target.get("role") not in ACTIVE:
            raise HTTPException(404, "Team member not found")
        if body.action == "escalate" and target["role"] not in ESCALATION_ROLES:
            raise HTTPException(400, "Escalations must go to an Approver, CFO or Admin")
        upd.update({"assignee_id": target["user_id"], "assignee_name": target.get("name") or target.get("email")})
        detail = f"→ {upd['assignee_name']} ({ROLE_LABELS.get(target['role'])}). {body.note}".strip()
        await notify(target["user_id"],
                     f"{'Escalated' if body.action == 'escalate' else 'Assigned'} to you: {c['number']}",
                     f"{member.get('name')} · {c['counterparty_name']} · {c['leak_amount']:,.2f} {c['currency']}. {body.note}",
                     f"/app/leakages/{case_id}")
        if target.get("email") and target["user_id"] != member["user_id"]:
            try:
                await send_email(
                    to=target["email"], subject=f"[{c['number']}] Leakage {body.action}d to you",
                    html=text_to_email_html(
                        f"Hi {target.get('name')},\n\n{member.get('name')} has {body.action}d leakage case {c['number']} "
                        f"to you.\n\nCounterparty: {c['counterparty_name']}\nReference: {c['ref']}\n"
                        f"Leakage: {c['leak_amount']:,.2f} {c['currency']}\nNote: {body.note or '-'}\n\n"
                        f"Sign in to the platform to review and take action.", "Internal workflow notification."),
                    reply_to=member.get("email"))
            except HTTPException:
                pass
    if body.action == "approve":
        s = await get_settings()
        if c["assurance"].get("verdict") == "DISAGREE":
            raise HTTPException(409, "Assurance disagreed with this finding — resolve before approving")
        if c["assurance"].get("auto") != "CONFIRM" and c["assurance"].get("verdict") != "CONFIRM":
            raise HTTPException(409, "Automated re-check disagrees — Assurance must confirm before approval")
        if c["leak_amount"] >= s["dual_approval_threshold"] and c["assurance"].get("verdict") != "CONFIRM":
            raise HTTPException(409, f"Claims ≥ {s['dual_approval_threshold']:,.0f} need Assurance confirmation first")
    if body.action == "dismiss" and not body.note.strip():
        raise HTTPException(400, "Add a reason for dismissing")
    if body.action == "record_recovery":
        if not body.amount or body.amount <= 0:
            raise HTTPException(400, "Enter the amount recovered")
        remaining = round(c["leak_amount"] - c.get("recovered_amount", 0), 2)
        if body.amount > remaining + 0.01:
            raise HTTPException(400, f"Amount exceeds the outstanding {remaining:,.2f}")
        total = round(c.get("recovered_amount", 0) + body.amount, 2)
        upd["recovered_amount"] = total
        to = "RECOVERED" if total >= c["leak_amount"] - 0.01 else "PARTIALLY_RECOVERED"
        detail = f"Recovered {body.amount:,.2f} (total {total:,.2f}). {body.note}".strip()
    if to:
        upd["status"] = to
    await db.cases.update_one({"id": case_id}, {"$set": upd})
    await audit(member, f"case.{body.action}", "case", case_id, detail, {"from": c["status"], "to": upd.get("status", c["status"])})
    return await _case(case_id)


class CommentIn(BaseModel):
    text: str


@router.post("/cases/{case_id}/comments")
async def add_comment(case_id: str, body: CommentIn, member: dict = Depends(require_cap("comment"))):
    await _case(case_id)
    if not body.text.strip():
        raise HTTPException(400, "Comment is empty")
    cm = {"id": new_id("cm_"), "user_id": member["user_id"], "name": member.get("name"),
          "role": member["role"], "text": body.text.strip()[:4000], "ts": now_iso()}
    await db.cases.update_one({"id": case_id}, {"$push": {"comments": cm}, "$set": {"updated_at": now_iso()}})
    await audit(member, "case.comment", "case", case_id, body.text.strip()[:140])
    return cm


class DraftIn(BaseModel):
    subject: str
    body: str


@router.put("/cases/{case_id}/draft")
async def save_draft(case_id: str, body: DraftIn, member: dict = Depends(require_cap("work_case"))):
    await _case(case_id)
    d = {"subject": body.subject[:300], "body": body.body[:20000], "updated_at": now_iso(), "by": member.get("name")}
    await db.cases.update_one({"id": case_id}, {"$set": {"draft": d}})
    await audit(member, "case.draft_saved", "case", case_id, "Recovery email draft edited")
    return d


class SendIn(BaseModel):
    kind: str = "claim"


@router.post("/cases/{case_id}/send")
async def send_claim(case_id: str, body: SendIn, member: dict = Depends(require_cap("send_claim"))):
    c = await _case(case_id)
    if body.kind == "claim" and c["status"] != "APPROVED":
        raise HTTPException(409, "Only approved cases can be sent as a claim")
    if body.kind == "follow_up" and c["status"] not in CLAIM_SET:
        raise HTTPException(409, "Follow-ups are only for claims already sent")
    if not c.get("draft") or not c["draft"].get("body", "").strip():
        raise HTTPException(400, "Draft the recovery email first")
    cp = await db.counterparties.find_one({"id": c["counterparty_id"]}, {"_id": 0})
    if not cp or not cp.get("contact_email"):
        raise HTTPException(400, "This counterparty has no dispute contact email — ask an Admin to add it")
    subject = c["draft"]["subject"] if body.kind == "claim" else f"Follow-up: {c['draft']['subject']}"
    html = text_to_email_html(c["draft"]["body"], f"Case {c['number']} · Ref {c['ref']}.")
    lock = await db.cases.update_one({"id": case_id, "sending": {"$ne": True}}, {"$set": {"sending": True}})
    if not lock.modified_count:
        raise HTTPException(409, "This email is already being sent")
    try:
        email_id = await send_email(to=cp["contact_email"], subject=subject, html=html, reply_to=member.get("email"))
    finally:
        await db.cases.update_one({"id": case_id}, {"$set": {"sending": False}})
    log = {"id": new_id("em_"), "kind": body.kind, "to": cp["contact_email"], "subject": subject,
           "by": member.get("name"), "ts": now_iso(), "provider_id": email_id}
    upd = {"updated_at": now_iso()}
    if body.kind == "claim":
        upd.update({"status": "CLAIM_SENT", "claim_sent_at": now_iso()})
    await db.cases.update_one({"id": case_id}, {"$push": {"emails": log}, "$set": upd})
    await audit(member, f"case.{body.kind}_sent", "case", case_id, f"Email to {cp['contact_email']}: {subject}")
    return await _case(case_id)


class AssuranceIn(BaseModel):
    verdict: str
    note: str = ""


@router.post("/cases/{case_id}/assurance")
async def adjudicate(case_id: str, body: AssuranceIn, member: dict = Depends(require_cap("adjudicate"))):
    if body.verdict not in ("CONFIRM", "DISAGREE"):
        raise HTTPException(400, "Verdict must be CONFIRM or DISAGREE")
    c = await _case(case_id)
    a = {**c["assurance"], "verdict": body.verdict, "by": member.get("name"), "note": body.note, "at": now_iso()}
    await db.cases.update_one({"id": case_id}, {"$set": {"assurance": a, "updated_at": now_iso()}})
    await audit(member, f"assurance.{body.verdict.lower()}", "case", case_id, body.note)
    if c.get("assignee_id"):
        await notify(c["assignee_id"], f"Assurance {body.verdict.lower()}ed {c['number']}", body.note or "",
                     f"/app/leakages/{case_id}")
    return await _case(case_id)


@router.get("/dashboard")
async def dashboard(member: dict = Depends(require_cap("read"))):
    cases = await db.cases.find({}, {"_id": 0, "lines": 0, "comments": 0, "emails": 0, "draft": 0}).to_list(20000)
    s = await get_settings()
    live = [c for c in cases if c["status"] != "DISMISSED"]
    identified = sum(c["leak_amount"] for c in live)
    recovered = sum(c.get("recovered_amount", 0) for c in live)
    recoverable = sum(c["leak_amount"] for c in live if c["status"] in OPEN_SET)
    in_claim = sum(c["leak_amount"] - c.get("recovered_amount", 0) for c in live if c["status"] in CLAIM_SET)
    written = sum(c["leak_amount"] - c.get("recovered_amount", 0) for c in live if c["status"] == "WRITTEN_OFF")
    by_domain, by_cp, trend, status_counts = {}, {}, {}, {}
    for c in live:
        d = by_domain.setdefault(c["domain"], {"domain": c["domain"], "identified": 0, "recovered": 0, "count": 0})
        d["identified"] += c["leak_amount"]; d["recovered"] += c.get("recovered_amount", 0); d["count"] += 1
        p = by_cp.setdefault(c["counterparty_name"], {"name": c["counterparty_name"], "identified": 0, "recovered": 0, "open": 0, "count": 0})
        p["identified"] += c["leak_amount"]; p["recovered"] += c.get("recovered_amount", 0); p["count"] += 1
        if c["status"] in OPEN_SET + CLAIM_SET:
            p["open"] += c["leak_amount"] - c.get("recovered_amount", 0)
        m = trend.setdefault(c["txn_date"][:7], {"month": c["txn_date"][:7], "identified": 0, "recovered": 0})
        m["identified"] += c["leak_amount"]; m["recovered"] += c.get("recovered_amount", 0)
    for c in cases:
        status_counts[c["status"]] = status_counts.get(c["status"], 0) + 1
    from datetime import date, timedelta
    horizon = (date.today() + timedelta(days=s["expiring_window_days"])).isoformat()
    expiring = sorted([c for c in cases if c["status"] in OPEN_SET and c["window_ends_at"] <= horizon],
                      key=lambda c: c["window_ends_at"])[:8]
    queue = [c for c in cases if c.get("assignee_id") == member["user_id"] and c["status"] in OPEN_SET + CLAIM_SET][:8]
    assurance_pending = len([c for c in cases if c["status"] in OPEN_SET and c["leak_amount"] >= s["dual_approval_threshold"]
                             and not c["assurance"].get("verdict")])
    r2 = lambda x: round(x, 2)
    return {
        "kpis": {"identified": r2(identified), "recoverable": r2(recoverable), "in_claim": r2(in_claim),
                 "recovered": r2(recovered), "written_off": r2(written),
                 "recovery_rate": round(recovered / identified * 100, 1) if identified else 0,
                 "cases": len(live), "open_cases": len([c for c in live if c["status"] in OPEN_SET])},
        "by_domain": [{**v, "identified": r2(v["identified"]), "recovered": r2(v["recovered"])} for v in by_domain.values()],
        "by_counterparty": sorted([{**v, "identified": r2(v["identified"]), "recovered": r2(v["recovered"]), "open": r2(v["open"])}
                                   for v in by_cp.values()], key=lambda x: -x["identified"]),
        "trend": sorted([{**v, "identified": r2(v["identified"]), "recovered": r2(v["recovered"])} for v in trend.values()],
                        key=lambda x: x["month"]),
        "status_counts": status_counts, "expiring": expiring, "my_queue": queue,
        "assurance_pending": assurance_pending, "settings": s,
    }


@router.get("/notifications")
async def notifications(member: dict = Depends(require_cap("read"))):
    items = await db.notifications.find({"user_id": member["user_id"]}, {"_id": 0}).sort("ts", -1).to_list(50)
    return {"items": items, "unread": len([i for i in items if not i["read"]])}


@router.post("/notifications/read-all")
async def read_all(member: dict = Depends(require_cap("read"))):
    await db.notifications.update_many({"user_id": member["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}
