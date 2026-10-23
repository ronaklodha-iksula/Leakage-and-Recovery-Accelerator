import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import (db, audit, current_member, require_cap, get_settings, caps_for, effective_role,
                  ROLES, ROLE_LABELS, RANK, IN_ENV, ACTIVE)

router = APIRouter(prefix="/api")
P = "_id"


@router.get("/me")
async def me(member: dict = Depends(current_member)):
    return {**member, "role_label": ROLE_LABELS[member["role"]], "caps": caps_for(member["role"])}


@router.get("/team")
async def team(member: dict = Depends(require_cap("read"))):
    people = await db.users.find({**IN_ENV, "role": {"$in": list(ACTIVE)}}, {"_id": 0}).to_list(1000)
    return [{"user_id": p["user_id"], "name": p.get("name"), "email": p.get("email"), "role": effective_role(p.get("role")),
             "role_label": ROLE_LABELS[effective_role(p.get("role"))]} for p in people]


@router.get("/users")
async def list_users(admin: dict = Depends(require_cap("manage_users"))):
    people = await db.users.find(IN_ENV, {"_id": 0}).to_list(1000)
    return {"roles": [{"key": r, "label": ROLE_LABELS[r]} for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role"))} for p in people]}


class RoleIn(BaseModel):
    role: str


@router.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_cap("manage_users"))):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    await audit(admin, "user.role_changed", "user", user_id, f"{target.get('email')} → {ROLE_LABELS[body.role]}")
    return {"user_id": user_id, "role": body.role}


@router.get("/settings")
async def read_settings(member: dict = Depends(require_cap("read"))):
    return await get_settings()


class SettingsIn(BaseModel):
    dual_approval_threshold: float
    expiring_window_days: int
    company_name: str
    auto_detect_on_upload: bool


@router.put("/settings")
async def write_settings(body: SettingsIn, admin: dict = Depends(require_cap("manage_settings"))):
    await get_settings()
    await db.settings.update_one({"id": "global"}, {"$set": body.model_dump()})
    await audit(admin, "settings.updated", "settings", "global", str(body.model_dump()))
    return await get_settings()


@router.delete("/admin/sample-data")
async def clear_sample(admin: dict = Depends(require_cap("manage_settings"))):
    out = {}
    for coll in ("cases", "transactions", "batches", "rules", "counterparties"):
        out[coll] = (await db[coll].delete_many({"sample": True})).deleted_count
    await audit(admin, "sample_data.cleared", "settings", "global", str(out))
    return out


@router.get("/audit")
async def audit_log(entity: str = "", actor: str = "", q: str = "", limit: int = 300,
                    member: dict = Depends(require_cap("read"))):
    f = {}
    if entity:
        f["entity"] = entity
    if actor:
        f["actor_id"] = actor
    if q:
        rq = re.escape(q)
        f["$or"] = [{"action": {"$regex": rq, "$options": "i"}}, {"detail": {"$regex": rq, "$options": "i"}}]
    return await db.audit.find(f, {"_id": 0}).sort("ts", -1).to_list(limit)
