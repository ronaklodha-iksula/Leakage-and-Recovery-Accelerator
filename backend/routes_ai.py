import json
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from core import db, now_iso, new_id, audit, require_cap, get_settings
from engine import DOMAINS

router = APIRouter(prefix="/api/ai")
P = "_id"
MODEL = ("anthropic", "claude-opus-5-5")
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _chat(system: str) -> LlmChat:
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=new_id("s_"), system_message=system).with_model(*MODEL)


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}\n\n"


DRAFT_SYSTEM = """You are a senior accounts-receivable recovery specialist writing on behalf of the company's finance team.
Write a firm, professional, courteous recovery/dispute email to the counterparty.
Rules: use ONLY facts provided; never invent numbers, dates, clause numbers or names. Cite the contract term given.
Structure: greeting; one-line purpose; a short itemised calculation (expected vs charged, variance); the contract basis;
a clear ask (credit/refund of the exact amount, by a reasonable date); mention the reference IDs; polite close signed by the sender.
Plain text only, no markdown symbols, no subject line. Keep under 230 words."""


@router.post("/cases/{case_id}/draft")
async def draft_email(case_id: str, member: dict = Depends(require_cap("work_case"))):
    c = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Case not found")
    cp = await db.counterparties.find_one({"id": c["counterparty_id"]}, {"_id": 0}) or {}
    s = await get_settings()
    facts = {
        "our_company": s["company_name"], "sender_name": member.get("name"), "counterparty": c["counterparty_name"],
        "counterparty_contact": cp.get("contact_name"), "domain": DOMAINS[c["domain"]]["label"],
        "leak_type": c["leak_type"], "reference": c["ref"], "transaction_date": c["txn_date"],
        "calculation_lines": c["lines"], "total_claim": f"{c['leak_amount']:,.2f} {c['currency']}",
        "finding": c["reason"], "contract_term": c["clause"], "contract_name": c["rule_name"],
        "contract_source": c.get("source_ref"), "dispute_window_ends": c["window_ends_at"], "case_number": c["number"],
    }
    subject = f"Claim {c['number']}: {c['leak_type'].replace('_', ' ').title()} on {c['ref']} — {c['leak_amount']:,.2f} {c['currency']}"

    async def gen():
        text = ""
        try:
            async for ev in _chat(DRAFT_SYSTEM).stream_message(UserMessage(text="Facts (JSON):\n" + json.dumps(facts, default=str))):
                if isinstance(ev, TextDelta):
                    text += ev.content
                    yield _sse({"delta": ev.content})
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            yield _sse({"error": f"AI drafting failed: {str(e)[:200]}"})
            return
        d = {"subject": subject, "body": text.strip(), "updated_at": now_iso(), "by": "AI draft · " + (member.get("name") or "")}
        await db.cases.update_one({"id": case_id}, {"$set": {"draft": d}})
        await audit(member, "case.draft_generated", "case", case_id, "AI drafted recovery email")
        yield _sse({"done": True, "subject": subject, "body": d["body"]})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


COPILOT_SYSTEM = """You are the Recovery Copilot inside a financial Leakage & Recovery platform used by CFOs and finance teams.
Answer using ONLY the JSON context (dashboard metrics and cases). Be concise and numeric; use short bullet lists.
Reference case numbers (e.g. LK-1012) when relevant. Recommend concrete next actions (escalate, draft claim, follow up before window expires).
If the data does not contain the answer, say so. Plain text with simple dashes for bullets; no markdown tables."""


class AskIn(BaseModel):
    question: str


@router.get("/copilot/history")
async def history(member: dict = Depends(require_cap("use_ai"))):
    doc = await db.chats.find_one({"user_id": member["user_id"]}, {"_id": 0})
    return (doc or {}).get("messages", [])


@router.delete("/copilot/history")
async def clear_history(member: dict = Depends(require_cap("use_ai"))):
    await db.chats.delete_one({"user_id": member["user_id"]})
    return {"ok": True}


@router.post("/copilot")
async def copilot(body: AskIn, member: dict = Depends(require_cap("use_ai"))):
    q = body.question.strip()[:2000]
    if not q:
        raise HTTPException(400, "Ask a question")
    from routes_cases import dashboard
    dash = await dashboard(member)
    cases = await db.cases.find({}, {"_id": 0, "number": 1, "status": 1, "domain": 1, "leak_type": 1, "counterparty_name": 1,
                                     "ref": 1, "leak_amount": 1, "recovered_amount": 1, "assignee_name": 1,
                                     "window_ends_at": 1, "reason": 1, "txn_date": 1}).sort("leak_amount", -1).to_list(60)
    doc = await db.chats.find_one({"user_id": member["user_id"]}, {"_id": 0}) or {"messages": []}
    past = doc["messages"][-8:]
    ctx = {"metrics": {k: dash[k] for k in ("kpis", "by_domain", "by_counterparty", "trend", "status_counts")},
           "expiring_soon": [{"number": c["number"], "window_ends_at": c["window_ends_at"], "leak": c["leak_amount"]} for c in dash["expiring"]],
           "top_cases": cases}
    convo = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in past)
    prompt = f"CONTEXT JSON:\n{json.dumps(ctx, default=str)}\n\nPREVIOUS CONVERSATION:\n{convo}\n\nUSER QUESTION: {q}"

    async def gen():
        text = ""
        try:
            async for ev in _chat(COPILOT_SYSTEM).stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    text += ev.content
                    yield _sse({"delta": ev.content})
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            yield _sse({"error": f"Copilot failed: {str(e)[:200]}"})
            return
        msgs = [{"role": "user", "text": q, "ts": now_iso()}, {"role": "assistant", "text": text.strip(), "ts": now_iso()}]
        await db.chats.update_one({"user_id": member["user_id"]}, {"$push": {"messages": {"$each": msgs}}}, upsert=True)
        yield _sse({"done": True})

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


class ExtractIn(BaseModel):
    domain: str
    text: str


@router.post("/extract-rule")
async def extract_rule(body: ExtractIn, member: dict = Depends(require_cap("author_rule"))):
    if body.domain not in DOMAINS:
        raise HTTPException(400, "Unknown domain")
    if len(body.text.strip()) < 30:
        raise HTTPException(400, "Paste more of the contract text")
    template = DOMAINS[body.domain]["default_terms"]
    system = ("You extract machine-executable commercial terms from contract text. Return ONLY a JSON object with exactly "
              "the same keys and value types as the template. Use values stated in the text; keep the template value when a term "
              "is not mentioned. Percentages as numbers (15 for 15%). Also add key \"_notes\" (string) listing which terms "
              "were found vs defaulted, and \"_clause\" (string) quoting the most relevant sentence.")
    try:
        resp = await _chat(system).send_message(UserMessage(
            text=f"TEMPLATE:\n{json.dumps(template)}\n\nCONTRACT TEXT:\n{body.text[:15000]}"))
    except Exception as e:
        raise HTTPException(502, f"AI extraction failed: {str(e)[:200]}")
    m = re.search(r"\{.*\}", resp if isinstance(resp, str) else str(resp), re.S)
    if not m:
        raise HTTPException(502, "AI did not return structured terms — try again")
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        raise HTTPException(502, "AI returned malformed terms — try again")
    notes, clause = data.pop("_notes", ""), data.pop("_clause", "")
    await audit(member, "rule.ai_extracted", "rule", "-", f"{body.domain}: {notes[:120]}")
    return {"terms": {k: data.get(k, v) for k, v in template.items()}, "notes": notes, "clause": clause}
