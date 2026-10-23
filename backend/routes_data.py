import io

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import db, now_iso, new_id, audit, require_cap, get_settings
from engine import DOMAINS
from services import run_detection, insert_transactions

router = APIRouter(prefix="/api")
P = "_id"


@router.get("/domains")
async def domains(member: dict = Depends(require_cap("read"))):
    return [{"key": k, "label": v["label"], "columns": v["columns"], "default_terms": v["default_terms"]}
            for k, v in DOMAINS.items()]


@router.get("/templates/{domain}")
async def template(domain: str, member: dict = Depends(require_cap("read"))):
    if domain not in DOMAINS:
        raise HTTPException(404, "Unknown domain")
    d = DOMAINS[domain]
    lines = [",".join(d["columns"])] + [",".join(str(x) for x in r) for r in d["sample"]]
    return StreamingResponse(iter(["\n".join(lines) + "\n"]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={domain.lower()}_template.csv"})


# ---------- counterparties ----------
class CounterpartyIn(BaseModel):
    name: str
    type: str = "MARKETPLACE"
    contact_name: str = ""
    contact_email: str = ""
    currency: str = "USD"
    portal_url: str = ""
    notes: str = ""


@router.get("/counterparties")
async def list_cps(member: dict = Depends(require_cap("read"))):
    return await db.counterparties.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("/counterparties")
async def create_cp(body: CounterpartyIn, member: dict = Depends(require_cap("manage_settings"))):
    cp = {**body.model_dump(), "id": new_id("cp_"), "created_at": now_iso()}
    await db.counterparties.insert_one({**cp})
    await audit(member, "counterparty.created", "counterparty", cp["id"], cp["name"])
    return cp


@router.put("/counterparties/{cp_id}")
async def update_cp(cp_id: str, body: CounterpartyIn, member: dict = Depends(require_cap("manage_settings"))):
    r = await db.counterparties.update_one({"id": cp_id}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Not found")
    await db.cases.update_many({"counterparty_id": cp_id}, {"$set": {"counterparty_name": body.name}})
    await audit(member, "counterparty.updated", "counterparty", cp_id, body.name)
    return await db.counterparties.find_one({"id": cp_id}, {"_id": 0})


@router.delete("/counterparties/{cp_id}")
async def delete_cp(cp_id: str, member: dict = Depends(require_cap("manage_settings"))):
    if await db.cases.count_documents({"counterparty_id": cp_id}) or await db.transactions.count_documents({"counterparty_id": cp_id}):
        raise HTTPException(409, "This counterparty has transactions or cases and can't be deleted")
    r = await db.counterparties.delete_one({"id": cp_id})
    if not r.deleted_count:
        raise HTTPException(404, "Not found")
    await db.rules.delete_many({"counterparty_id": cp_id})
    await audit(member, "counterparty.deleted", "counterparty", cp_id, "")
    return {"ok": True}


# ---------- truth layer (contract rules) ----------
class RuleIn(BaseModel):
    name: str
    counterparty_id: str
    domain: str
    effective_from: str
    effective_to: str
    source_ref: str = ""
    clause_text: str = ""
    terms: dict


@router.get("/rules")
async def list_rules(member: dict = Depends(require_cap("read"))):
    return await db.rules.find({}, {"_id": 0}).sort([("counterparty_name", 1), ("domain", 1), ("version", -1)]).to_list(1000)


async def _validate_rule(body: RuleIn) -> dict:
    if body.domain not in DOMAINS:
        raise HTTPException(400, "Unknown domain")
    cp = await db.counterparties.find_one({"id": body.counterparty_id}, {"_id": 0})
    if not cp:
        raise HTTPException(400, "Unknown counterparty")
    if body.effective_from > body.effective_to:
        raise HTTPException(400, "Effective-from must be before effective-to")
    return cp


@router.post("/rules")
async def create_rule(body: RuleIn, member: dict = Depends(require_cap("author_rule"))):
    cp = await _validate_rule(body)
    last = await db.rules.find_one({"counterparty_id": body.counterparty_id, "domain": body.domain},
                                   {"_id": 0}, sort=[("version", -1)])
    rule = {**body.model_dump(), "id": new_id("rule_"), "counterparty_name": cp["name"],
            "version": (last["version"] + 1) if last else 1, "status": "DRAFT",
            "created_by": member.get("name"), "created_at": now_iso(), "published_at": None}
    await db.rules.insert_one({**rule})
    await audit(member, "rule.drafted", "rule", rule["id"], f"{rule['name']} v{rule['version']}")
    return rule


@router.put("/rules/{rule_id}")
async def edit_rule(rule_id: str, body: RuleIn, member: dict = Depends(require_cap("author_rule"))):
    rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule:
        raise HTTPException(404, "Not found")
    if rule["status"] != "DRAFT":
        return await create_rule(body, member)  # published rules are immutable; editing makes a new version
    cp = await _validate_rule(body)
    await db.rules.update_one({"id": rule_id}, {"$set": {**body.model_dump(), "counterparty_name": cp["name"]}})
    await audit(member, "rule.edited", "rule", rule_id, body.name)
    return await db.rules.find_one({"id": rule_id}, {"_id": 0})


@router.post("/rules/{rule_id}/publish")
async def publish_rule(rule_id: str, member: dict = Depends(require_cap("publish_rule"))):
    rule = await db.rules.find_one({"id": rule_id}, {"_id": 0})
    if not rule or rule["status"] != "DRAFT":
        raise HTTPException(409, "Only draft rules can be published")
    await db.rules.update_many({"counterparty_id": rule["counterparty_id"], "domain": rule["domain"], "status": "PUBLISHED"},
                               {"$set": {"status": "RETIRED"}})
    await db.rules.update_one({"id": rule_id}, {"$set": {"status": "PUBLISHED", "published_at": now_iso(),
                                                        "published_by": member.get("name")}})
    await audit(member, "rule.published", "rule", rule_id, f"{rule['name']} v{rule['version']}")
    n = await db.transactions.update_many({"counterparty_id": rule["counterparty_id"], "domain": rule["domain"],
                                           "result": "NO_RULE"}, {"$set": {"evaluated": False}})
    return {"ok": True, "requeued": n.modified_count}


@router.post("/rules/{rule_id}/retire")
async def retire_rule(rule_id: str, member: dict = Depends(require_cap("publish_rule"))):
    r = await db.rules.update_one({"id": rule_id, "status": "PUBLISHED"}, {"$set": {"status": "RETIRED"}})
    if not r.matched_count:
        raise HTTPException(409, "Only published rules can be retired")
    await audit(member, "rule.retired", "rule", rule_id, "")
    return {"ok": True}


# ---------- ingestion ----------
@router.post("/ingest")
async def ingest(file: UploadFile = File(...), domain: str = Form(...), counterparty_id: str = Form(...),
                 member: dict = Depends(require_cap("upload"))):
    if domain not in DOMAINS:
        raise HTTPException(400, "Unknown domain")
    cp = await db.counterparties.find_one({"id": counterparty_id}, {"_id": 0})
    if not cp:
        raise HTTPException(400, "Unknown counterparty")
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "File too large (10 MB max)")
    name = (file.filename or "upload").lower()
    try:
        df = pd.read_excel(io.BytesIO(raw)) if name.endswith((".xlsx", ".xls")) else pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(400, f"Could not read file: {e}")
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    missing = [c for c in DOMAINS[domain]["columns"] if c not in df.columns]
    if missing:
        raise HTTPException(422, f"Missing required columns: {', '.join(missing)}")
    df["date"] = df["date"].astype(str).str[:10]
    for c in ("promised_date", "delivered_date"):
        if c in df.columns:
            df[c] = df[c].astype(str).str[:10]
    rows = df.to_dict(orient="records")
    batch_id = new_id("bat_")
    res = await insert_transactions(rows, domain, cp, batch_id)
    batch = {"id": batch_id, "filename": file.filename, "domain": domain, "counterparty_id": cp["id"],
             "counterparty_name": cp["name"], "rows": len(rows), "inserted": res["inserted"], "skipped": res["skipped"],
             "uploaded_by": member.get("name"), "created_at": now_iso(), "detection": None}
    s = await get_settings()
    if s.get("auto_detect_on_upload", True):
        batch["detection"] = await run_detection(member, batch_id)
    await db.batches.insert_one({**batch})
    await audit(member, "data.uploaded", "batch", batch_id, f"{file.filename}: {res['inserted']} rows ({domain})")
    return batch


@router.get("/batches")
async def batches(member: dict = Depends(require_cap("read"))):
    return await db.batches.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


class DetectIn(BaseModel):
    batch_id: str | None = None


@router.post("/detect")
async def detect(body: DetectIn, member: dict = Depends(require_cap("detect"))):
    stats = await run_detection(member, body.batch_id)
    if body.batch_id:
        await db.batches.update_one({"id": body.batch_id}, {"$set": {"detection": stats}})
    await audit(member, "detection.run", "batch", body.batch_id or "*", f"{stats['leaks']} leaks, {stats['amount']:.2f}")
    return stats


@router.get("/transactions")
async def transactions(domain: str = "", result: str = "", batch_id: str = "", limit: int = 300,
                       member: dict = Depends(require_cap("read"))):
    f = {}
    if domain:
        f["domain"] = domain
    if result:
        f["result"] = result
    if batch_id:
        f["batch_id"] = batch_id
    items = await db.transactions.find(f, {"_id": 0, "row_hash": 0}).sort("seq", -1).to_list(limit)
    counts = {}
    async for r in db.transactions.aggregate([{"$group": {"_id": "$result", "n": {"$sum": 1}}}]):
        counts[str(r["_id"])] = r["n"]
    return {"items": items, "counts": counts}
