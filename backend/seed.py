"""Idempotent sample data: counterparties, contract rules and transactions with planted leakages."""
import random
from datetime import date, timedelta

from core import db, now_iso
from services import insert_transactions, run_detection

Y = "2026"
CPS = [
    {"id": "cp_amazon", "name": "Amazon Seller Central", "type": "MARKETPLACE", "contact_name": "Seller Support – Reimbursements",
     "contact_email": "seller-disputes@example.com", "currency": "USD", "portal_url": "https://sellercentral.amazon.com"},
    {"id": "cp_walmart", "name": "Walmart Supplier", "type": "RETAILER", "contact_name": "Supplier Deductions Team",
     "contact_email": "deductions@example.com", "currency": "USD", "portal_url": "https://supplier.walmart.com"},
    {"id": "cp_target", "name": "Target Vendor", "type": "RETAILER", "contact_name": "Vendor Compliance Desk",
     "contact_email": "vendor-compliance@example.com", "currency": "USD", "portal_url": ""},
    {"id": "cp_midwest", "name": "Midwest Builders Supply", "type": "SUPPLIER", "contact_name": "Accounts Receivable",
     "contact_email": "ar@example.com", "currency": "USD", "portal_url": ""},
    {"id": "cp_valuestores", "name": "ValueStores Distribution", "type": "SUPPLIER", "contact_name": "Trade Rebates",
     "contact_email": "rebates@example.com", "currency": "USD", "portal_url": ""},
    {"id": "cp_expresscomm", "name": "ExpressComm Logistics", "type": "CARRIER", "contact_name": "Freight Billing Disputes",
     "contact_email": "freight-billing@example.com", "currency": "USD", "portal_url": ""},
]
PRICES = {"PVC-PIPE-2IN": 4.10, "COPPER-FIT-34": 2.85, "DRYWALL-SHT-4X8": 11.40, "CEMENT-BAG-50": 9.75}
REF_PCT = {"Kitchen": 15.0, "Sports": 15.0, "Home": 15.0, "Electronics": 8.0, "Beauty": 8.0, "default": 15.0}
RULES = [
    ("rule_amz_v1", "cp_amazon", "MARKETPLACE_FEE", "Amazon Business Solutions Agreement 2025", 1, "RETIRED", "2025-01-01", "2025-12-31",
     {"referral_fee_pct": {**REF_PCT, "Kitchen": 15.0}, "referral_min_fee": 0.30, "fulfillment_fee_per_unit": 5.10,
      "closing_fee_per_unit": 0.0, "tolerance_amount": 0.05, "dispute_window_days": 90}),
    ("rule_amz_v2", "cp_amazon", "MARKETPLACE_FEE", "Amazon Business Solutions Agreement 2026 – Fee Schedule", 2, "PUBLISHED", f"{Y}-01-01", f"{Y}-12-31",
     {"referral_fee_pct": REF_PCT, "referral_min_fee": 0.30, "fulfillment_fee_per_unit": 5.40,
      "closing_fee_per_unit": 0.0, "tolerance_amount": 0.05, "dispute_window_days": 90}),
    ("rule_wmt", "cp_walmart", "RETAIL_DEDUCTION", "Walmart Supplier Agreement – OTIF Addendum", 1, "PUBLISHED", f"{Y}-01-01", f"{Y}-12-31",
     {"late_grace_days": 0, "fill_tolerance_pct": 2.0, "penalty_pct": 3.0, "valid_reason_codes": ["OTIF_LATE", "OTIF_SHORT"], "dispute_window_days": 60}),
    ("rule_tgt", "cp_target", "RETAIL_DEDUCTION", "Target Vendor Compliance Program 2026", 1, "PUBLISHED", f"{Y}-01-01", f"{Y}-12-31",
     {"late_grace_days": 1, "fill_tolerance_pct": 5.0, "penalty_pct": 2.0, "valid_reason_codes": ["OTIF_LATE", "OTIF_SHORT"], "dispute_window_days": 90}),
    ("rule_mws", "cp_midwest", "PRICE_VARIANCE", "Midwest Special Pricing Agreement (SPA-2026)", 1, "PUBLISHED", f"{Y}-01-01", f"{Y}-12-31",
     {"price_list": PRICES, "tolerance_pct": 0.5, "dispute_window_days": 120}),
    ("rule_vsd", "cp_valuestores", "REBATE", "ValueStores Volume Rebate Program", 1, "PUBLISHED", f"{Y}-01-01", f"{Y}-12-31",
     {"tiers": [{"min_volume": 0, "pct": 1.0}, {"min_volume": 500000, "pct": 2.0}, {"min_volume": 1000000, "pct": 3.0}], "dispute_window_days": 180}),
    ("rule_exc", "cp_expresscomm", "FREIGHT", "ExpressComm LTL Rate Card 2026", 1, "PUBLISHED", f"{Y}-01-01", f"{Y}-12-31",
     {"rate_per_kg": 1.10, "fuel_surcharge_pct": 12.0, "min_charge": 150.0, "max_accessorial": 50.0, "tolerance_amount": 1.0, "dispute_window_days": 90}),
]
CLAUSES = {
    "MARKETPLACE_FEE": "Referral fees are charged as a percentage of the total sales price per the category fee schedule; FBA fulfilment fees per unit as published in the Fee Schedule effective for the period.",
    "RETAIL_DEDUCTION": "Supplier shall be assessed an OTIF compliance charge only where cases are not delivered within the must-arrive-by window or below the fill tolerance.",
    "PRICE_VARIANCE": "Supplier shall invoice at the net prices listed in Schedule A for the agreement term.",
    "REBATE": "A retroactive volume rebate is earned at the highest tier reached on total quarterly purchases.",
    "FREIGHT": "Linehaul charges at contracted rate per kg plus fuel surcharge; accessorials capped per shipment.",
}


def _dates(rng, n, start=date(2026, 5, 1), end=date(2026, 10, 18)):
    span = (end - start).days
    return sorted((start + timedelta(days=rng.randint(0, span))).isoformat() for _ in range(n))


def _rows(rng):
    out = {}
    amz = []
    cats = [("Kitchen", "BLND-PRO-500", 89.99), ("Sports", "MAT-YOGA-06", 34.50), ("Electronics", "EARBUD-X2", 59.00),
            ("Home", "LAMP-ARC-01", 129.00), ("Beauty", "SERUM-VC-30", 24.00)]
    for i, d in enumerate(_dates(rng, 42)):
        cat, sku, price = cats[i % len(cats)]
        qty = rng.randint(40, 320)
        ref = price * qty * REF_PCT[cat] / 100
        ful = 5.40 * qty
        kind = i % 6
        if kind == 1:
            ref = price * qty * (REF_PCT[cat] + 2) / 100  # silent referral rate hike
        elif kind == 3:
            ful = 6.15 * qty  # FBA fee charged above schedule
        elif kind == 5 and cat in ("Electronics", "Beauty"):
            ref = price * qty * 15 / 100  # wrong category rate
        amz.append({"order_id": f"114-{7781000 + i * 37}", "date": d, "sku": sku, "category": cat, "qty": qty,
                    "item_price": price, "referral_fee_charged": round(ref, 2), "fulfillment_fee_charged": round(ful, 2),
                    "closing_fee_charged": 1.80 if i % 11 == 7 else 0})
    out[("cp_amazon", "MARKETPLACE_FEE")] = amz

    for cp, n in (("cp_walmart", 11), ("cp_target", 6)):
        rows = []
        for i, d in enumerate(_dates(rng, n)):
            po = rng.randint(18, 95) * 1000
            promised = date.fromisoformat(d) - timedelta(days=12)
            late = i % 3 == 2
            delivered = promised + timedelta(days=3 if late else 0)
            qo = rng.randint(400, 2000)
            qd = qo if i % 4 != 3 else int(qo * 0.9)
            code = "OTIF_LATE" if late or qd == qo else "OTIF_SHORT"
            if i == 4:
                code = "PALLET_NONCOMPLIANCE"
            pct = 3.0 if cp == "cp_walmart" else 2.0
            ded = po * (pct + (1.5 if i == 5 else 0)) / 100
            rows.append({"deduction_id": f"{'WMT' if cp == 'cp_walmart' else 'TGT'}-DED-{55000 + i * 13}", "date": d,
                         "po_number": f"PO-{88100 + i * 7}", "reason_code": code, "po_amount": po, "deduction_amount": round(ded, 2),
                         "promised_date": promised.isoformat(), "delivered_date": delivered.isoformat(),
                         "qty_ordered": qo, "qty_delivered": qd})
        if cp == "cp_walmart":
            dup = dict(rows[2]); dup["deduction_id"] = "WMT-DED-56999"; dup["date"] = "2026-10-02"
            rows.append(dup)
        out[(cp, "RETAIL_DEDUCTION")] = rows

    mws = []
    skus = list(PRICES)
    for i, d in enumerate(_dates(rng, 16)):
        sku = skus[i % 4]
        price = PRICES[sku] * (1.08 if i % 3 == 0 else 1.0)
        mws.append({"invoice_no": f"MWS-INV-{30400 + i * 3}", "date": d, "sku": sku, "qty": rng.randint(150, 900),
                    "invoiced_unit_price": round(price, 2)})
    dup = dict(mws[5]); dup["invoice_no"] = "MWS-INV-39001"
    mws.append(dup)
    out[("cp_midwest", "PRICE_VARIANCE")] = mws

    out[("cp_valuestores", "REBATE")] = [
        {"statement_id": "VSD-RB-2026-Q1", "date": "2026-03-31", "period": "2026-Q1", "purchase_volume": 820000, "rebate_paid": 16400},
        {"statement_id": "VSD-RB-2026-Q2", "date": "2026-06-30", "period": "2026-Q2", "purchase_volume": 1180000, "rebate_paid": 23600},
        {"statement_id": "VSD-RB-2026-Q3", "date": "2026-09-30", "period": "2026-Q3", "purchase_volume": 1340000, "rebate_paid": 26800},
    ]

    exc = []
    lanes = [("Dallas", "Chicago"), ("Memphis", "Atlanta"), ("Reno", "Denver"), ("Newark", "Columbus")]
    for i, d in enumerate(_dates(rng, 16)):
        w = rng.randint(300, 4200)
        billed = max(150, w * 1.10) * 1.12
        if i % 4 == 1:
            billed = max(150, w * 1.24) * 1.12  # rate above card
        acc = 85 if i % 5 == 2 else rng.choice([0, 25, 40])
        o, de = lanes[i % 4]
        exc.append({"invoice_no": f"EXC-{77100 + i * 9}", "date": d, "shipment_id": f"SHP-{40900 + i * 11}", "origin": o,
                    "destination": de, "weight_kg": w, "billed_amount": round(billed, 2), "accessorial_charged": acc})
    dup = dict(exc[7]); dup["invoice_no"] = "EXC-79999"
    exc.append(dup)
    out[("cp_expresscomm", "FREIGHT")] = exc
    return out


PROGRESS = ["RECOVERED", "RECOVERED", "CLAIM_SENT", "PARTIALLY_RECOVERED", "APPROVED", "RECOVERED",
            "IN_REVIEW", "CLAIM_SENT", "DISMISSED", "RECOVERED", "WRITTEN_OFF", "ESCALATED"]


async def seed_if_empty():
    if await db.counterparties.count_documents({}) > 0:
        return
    rng = random.Random(42)
    for cp in CPS:
        await db.counterparties.insert_one({**cp, "sample": True, "created_at": now_iso()})
    names = {c["id"]: c["name"] for c in CPS}
    for rid, cp, dom, name, ver, status, ef, et, terms in RULES:
        await db.rules.insert_one({"id": rid, "name": name, "counterparty_id": cp, "counterparty_name": names[cp], "domain": dom,
                                   "version": ver, "status": status, "effective_from": ef, "effective_to": et, "terms": terms,
                                   "source_ref": name, "clause_text": CLAUSES[dom], "created_by": "System (sample)",
                                   "created_at": now_iso(), "published_at": now_iso(), "sample": True})
    for (cp_id, dom), rows in _rows(rng).items():
        cp = next(c for c in CPS if c["id"] == cp_id)
        bid = f"bat_sample_{cp_id[3:]}"
        res = await insert_transactions(rows, dom, cp, bid)
        await db.batches.insert_one({"id": bid, "filename": f"sample_{cp_id[3:]}_{dom.lower()}.csv", "domain": dom,
                                     "counterparty_id": cp_id, "counterparty_name": cp["name"], "rows": len(rows),
                                     "inserted": res["inserted"], "skipped": res["skipped"], "uploaded_by": "System (sample)",
                                     "created_at": now_iso(), "detection": None, "sample": True})
    await run_detection(None)
    await db.transactions.update_many({}, {"$set": {"sample": True}})
    cases = await db.cases.find({}, {"_id": 0}).sort("txn_date", 1).to_list(1000)
    for i, c in enumerate(cases):
        if c["txn_date"] > "2026-09-25":
            upd = {"sample": True}
        else:
            st = PROGRESS[i % len(PROGRESS)]
            rec = c["leak_amount"] if st == "RECOVERED" else round(c["leak_amount"] * 0.5, 2) if st == "PARTIALLY_RECOVERED" else 0
            upd = {"sample": True, "status": st, "recovered_amount": rec}
            if st in ("CLAIM_SENT", "PARTIALLY_RECOVERED", "RECOVERED"):
                upd["emails"] = [{"id": f"em_s{i}", "kind": "claim", "to": "(sample history)", "subject": f"Claim {c['number']}",
                                  "by": "Sample data", "ts": c["txn_date"] + "T10:00:00+00:00", "provider_id": None}]
            if st in ("APPROVED", "CLAIM_SENT", "PARTIALLY_RECOVERED", "RECOVERED"):
                upd["assurance"] = {**c["assurance"], "verdict": "CONFIRM", "by": "Sample data", "note": "Re-check matches", "at": now_iso()}
        await db.cases.update_one({"id": c["id"]}, {"$set": upd})
