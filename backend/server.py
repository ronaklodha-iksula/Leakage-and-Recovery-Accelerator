import logging
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import db, client, RETIRED_ROLES
from clerk_auth import clerk_router
import routes_admin
import routes_ai
import routes_cases
import routes_data
from seed import seed_if_empty

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="L&R Accelerator")
app.include_router(clerk_router)
app.include_router(routes_admin.router)
app.include_router(routes_cases.router)
app.include_router(routes_data.router)
app.include_router(routes_ai.router)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.on_event("startup")
async def startup():
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})
    await db.cases.create_index("id", unique=True)
    await db.transactions.create_index([("counterparty_id", 1), ("domain", 1), ("dup_key", 1)])
    await db.audit.create_index([("entity_id", 1), ("ts", -1)])
    await seed_if_empty()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
