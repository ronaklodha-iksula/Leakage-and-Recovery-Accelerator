import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from starlette.concurrency import run_in_threadpool

load_dotenv(Path(__file__).parent / ".env")

try:
    from backend.clerk_auth import require_user
except ModuleNotFoundError:
    from clerk_auth import require_user

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# Role list is code (highest first). "pending" = signed up, awaiting admin approval.
ROLES = ["admin", "viewer_cfo", "approver", "assurance", "rule_author", "analyst", "pending"]
ROLE_LABELS = {
    "admin": "Admin", "viewer_cfo": "Viewer / CFO", "approver": "Approver",
    "assurance": "Assurance", "rule_author": "Rule Author", "analyst": "Analyst", "pending": "Pending approval",
}
DEFAULT_ROLE = "pending"
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}

ACTIVE = {"admin", "viewer_cfo", "approver", "assurance", "rule_author", "analyst"}
CAPS = {
    "read": ACTIVE,
    "comment": ACTIVE,
    "upload": {"analyst", "admin"},
    "detect": {"analyst", "admin"},
    "work_case": {"analyst", "approver", "admin"},
    "assign": {"analyst", "approver", "admin"},
    "approve": {"approver", "admin", "viewer_cfo"},
    "send_claim": {"approver", "admin"},
    "record_recovery": {"approver", "admin"},
    "write_off": {"approver", "admin"},
    "adjudicate": {"assurance", "admin"},
    "author_rule": {"rule_author", "admin"},
    "publish_rule": {"rule_author", "admin"},
    "manage_users": {"admin"},
    "manage_settings": {"admin"},
    "use_ai": {"analyst", "approver", "admin", "viewer_cfo", "assurance", "rule_author"},
}
ESCALATION_ROLES = ["approver", "admin", "viewer_cfo"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def caps_for(role: str) -> list:
    return [c for c, roles in CAPS.items() if role in roles]


def _clerk_profile(user_id: str) -> dict:
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    u = r.json()
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    emails = u.get("email_addresses") or []
    primary = next((e for e in emails if e["id"] == u.get("primary_email_address_id")), emails[0] if emails else {})
    is_admin = any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified" for e in emails)
    name = " ".join(x for x in [u.get("first_name"), u.get("last_name")] if x) or (primary.get("email_address", "").split("@")[0])
    return {"email": primary.get("email_address", ""), "name": name, "is_admin": is_admin}


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role") or not member.get("email"):
        prof = await run_in_threadpool(_clerk_profile, uid)
        role = "admin" if prof["is_admin"] else DEFAULT_ROLE
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role}})
        member = await db.users.find_one_and_update(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "role": role, "created_at": now_iso()},
             "$set": {"email": prof["email"], "name": prof["name"]}},
            upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("role") == "pending":
        prof = await run_in_threadpool(_clerk_profile, uid)
        if prof["is_admin"]:
            await db.users.update_one({"user_id": uid, "role": "pending"}, {"$set": {"role": "admin"}})
            member = {**member, "role": "admin"}
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    return {**member, "env": ENV, "role": effective_role(member["role"])}


def require_cap(cap: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in CAPS[cap]:
            raise HTTPException(status_code=403, detail="Your role does not allow this action")
        return member
    return check


async def audit(member: dict | None, action: str, entity: str, entity_id: str, detail: str = "", data: dict | None = None):
    await db.audit.insert_one({
        "id": new_id("evt_"), "ts": now_iso(),
        "actor_id": member["user_id"] if member else "system",
        "actor_name": member.get("name") if member else "System",
        "actor_role": member["role"] if member else "system",
        "action": action, "entity": entity, "entity_id": entity_id, "detail": detail, "data": data or {},
    })


async def notify(user_id: str, title: str, body: str, link: str):
    await db.notifications.insert_one({"id": new_id("ntf_"), "user_id": user_id, "title": title,
                                       "body": body, "link": link, "read": False, "ts": now_iso()})


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "dual_approval_threshold": 5000.0, "expiring_window_days": 14,
             "company_name": "Acme Consumer Brands", "auto_detect_on_upload": True}
        await db.settings.insert_one({**s})
    return s
