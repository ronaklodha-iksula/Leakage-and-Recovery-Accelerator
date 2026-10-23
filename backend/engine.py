"""Deterministic leakage detection: transaction facts vs published contract terms."""
from datetime import datetime, timedelta

DOMAINS = {
    "MARKETPLACE_FEE": {
        "label": "Marketplace fees",
        "columns": ["order_id", "date", "sku", "category", "qty", "item_price",
                    "referral_fee_charged", "fulfillment_fee_charged", "closing_fee_charged"],
        "ref": "order_id",
        "sample": [["114-7781-0091", "2026-09-14", "BLND-PRO-500", "Kitchen", 2, 89.99, 30.60, 11.20, 0],
                   ["114-7781-0092", "2026-09-15", "MAT-YOGA-06", "Sports", 1, 34.50, 5.18, 5.40, 0]],
        "default_terms": {"referral_fee_pct": {"default": 15.0}, "referral_min_fee": 0.30,
                          "fulfillment_fee_per_unit": 5.40, "closing_fee_per_unit": 0.0,
                          "tolerance_amount": 0.05, "dispute_window_days": 90},
    },
    "RETAIL_DEDUCTION": {
        "label": "Retail deductions (OTIF)",
        "columns": ["deduction_id", "date", "po_number", "reason_code", "po_amount", "deduction_amount",
                    "promised_date", "delivered_date", "qty_ordered", "qty_delivered"],
        "ref": "deduction_id",
        "sample": [["DED-55012", "2026-09-02", "PO-88120", "OTIF_LATE", 42000, 1260, "2026-08-20", "2026-08-20", 1200, 1200]],
        "default_terms": {"late_grace_days": 0, "fill_tolerance_pct": 2.0, "penalty_pct": 3.0,
                          "valid_reason_codes": ["OTIF_LATE", "OTIF_SHORT"], "dispute_window_days": 60},
    },
    "PRICE_VARIANCE": {
        "label": "Supplier price variance",
        "columns": ["invoice_no", "date", "sku", "qty", "invoiced_unit_price"],
        "ref": "invoice_no",
        "sample": [["INV-30441", "2026-09-10", "PVC-PIPE-2IN", 400, 4.35]],
        "default_terms": {"price_list": {}, "tolerance_pct": 0.5, "dispute_window_days": 120},
    },
    "REBATE": {
        "label": "Rebate shortfall",
        "columns": ["statement_id", "date", "period", "purchase_volume", "rebate_paid"],
        "ref": "statement_id",
        "sample": [["RB-2026-Q3", "2026-09-30", "2026-Q3", 1250000, 25000]],
        "default_terms": {"tiers": [{"min_volume": 0, "pct": 1.0}, {"min_volume": 500000, "pct": 2.0},
                                    {"min_volume": 1000000, "pct": 3.0}], "dispute_window_days": 180},
    },
    "FREIGHT": {
        "label": "Freight overcharge",
        "columns": ["invoice_no", "date", "shipment_id", "origin", "destination", "weight_kg",
                    "billed_amount", "accessorial_charged"],
        "ref": "invoice_no",
        "sample": [["FRT-77120", "2026-09-08", "SHP-40912", "Dallas", "Chicago", 1200, 1610, 85]],
        "default_terms": {"rate_per_kg": 1.10, "fuel_surcharge_pct": 12.0, "min_charge": 150.0,
                          "max_accessorial": 50.0, "tolerance_amount": 1.0, "dispute_window_days": 90},
    },
}


def _f(v, default=0.0):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def _d(v):
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def _line(label, expected, actual):
    return {"label": label, "expected": round(expected, 2), "actual": round(actual, 2),
            "variance": round(actual - expected, 2)}


def eval_marketplace(t, terms):
    qty = _f(t.get("qty"), 1)
    price = _f(t.get("item_price"))
    pct_map = terms.get("referral_fee_pct", {})
    pct = _f(pct_map.get(t.get("category"), pct_map.get("default", 15)))
    exp_ref = max(price * qty * pct / 100, _f(terms.get("referral_min_fee")) * qty)
    exp_ful = _f(terms.get("fulfillment_fee_per_unit")) * qty
    exp_clo = _f(terms.get("closing_fee_per_unit")) * qty
    lines = [_line(f"Referral fee ({pct:g}% of {price * qty:,.2f})", exp_ref, _f(t.get("referral_fee_charged"))),
             _line(f"Fulfilment fee ({qty:g} units)", exp_ful, _f(t.get("fulfillment_fee_charged"))),
             _line("Closing fee", exp_clo, _f(t.get("closing_fee_charged")))]
    tol = _f(terms.get("tolerance_amount"), 0.05)
    over = [ln for ln in lines if ln["variance"] > tol]
    leak = sum(ln["variance"] for ln in over)
    reason = "; ".join(f"{ln['label'].split(' (')[0]} overcharged by {ln['variance']:,.2f}" for ln in over)
    clause = f"Referral fee schedule: {t.get('category')} = {pct:g}%; fulfilment {terms.get('fulfillment_fee_per_unit')}/unit"
    return leak, lines, reason, clause, "FEE_OVERCHARGE"


def eval_deduction(t, terms):
    po_amt = _f(t.get("po_amount"))
    ded = _f(t.get("deduction_amount"))
    promised, delivered = _d(t.get("promised_date")), _d(t.get("delivered_date"))
    q_o, q_d = _f(t.get("qty_ordered")), _f(t.get("qty_delivered"))
    grace = int(_f(terms.get("late_grace_days")))
    fill = (q_d / q_o * 100) if q_o else 0
    on_time = bool(promised and delivered and delivered <= promised + timedelta(days=grace))
    in_full = fill >= 100 - _f(terms.get("fill_tolerance_pct"), 2)
    code_ok = t.get("reason_code") in terms.get("valid_reason_codes", [])
    if not code_ok:
        valid_penalty, why = 0.0, f"Reason code {t.get('reason_code')} is not permitted under the agreement"
    elif on_time and in_full:
        valid_penalty, why = 0.0, f"Delivered on time and in full ({fill:.1f}% fill) — no OTIF penalty applies"
    else:
        valid_penalty = po_amt * _f(terms.get("penalty_pct"), 3) / 100
        why = f"{'Late' if not on_time else 'Short'} delivery — contractual penalty capped at {terms.get('penalty_pct')}% of PO"
    lines = [_line("OTIF penalty", valid_penalty, ded)]
    leak = max(ded - valid_penalty, 0)
    clause = f"OTIF terms: grace {grace}d, fill tolerance {terms.get('fill_tolerance_pct')}%, penalty {terms.get('penalty_pct')}% of PO"
    return leak, lines, why, clause, "INVALID_DEDUCTION"


def eval_price(t, terms):
    sku = t.get("sku")
    agreed = terms.get("price_list", {}).get(sku)
    if agreed is None:
        return 0, [], "", "", ""
    qty, inv = _f(t.get("qty")), _f(t.get("invoiced_unit_price"))
    agreed = _f(agreed)
    lines = [_line(f"{sku} × {qty:g} units", agreed * qty, inv * qty)]
    leak = (inv - agreed) * qty if inv > agreed * (1 + _f(terms.get("tolerance_pct"), 0.5) / 100) else 0
    why = f"Invoiced {inv:,.2f}/unit vs agreed {agreed:,.2f}/unit"
    return leak, lines, why, f"Price list: {sku} = {agreed:,.2f}/unit (tolerance {terms.get('tolerance_pct')}%)", "PRICE_OVERBILL"


def eval_rebate(t, terms):
    vol, paid = _f(t.get("purchase_volume")), _f(t.get("rebate_paid"))
    tiers = sorted(terms.get("tiers", []), key=lambda x: _f(x["min_volume"]))
    tier = None
    for tr in tiers:
        if vol >= _f(tr["min_volume"]):
            tier = tr
    pct = _f(tier["pct"]) if tier else 0
    expected = vol * pct / 100
    lines = [_line(f"Rebate at {pct:g}% tier on {vol:,.0f}", expected, paid)]
    leak = max(expected - paid, 0) if expected - paid > 1 else 0
    why = f"Volume {vol:,.0f} qualifies for {pct:g}% tier; paid {paid / vol * 100 if vol else 0:.2f}%"
    return leak, lines, why, f"Rebate tier ≥{_f(tier['min_volume']) if tier else 0:,.0f} = {pct:g}%", "REBATE_SHORTFALL"


def eval_freight(t, terms):
    w = _f(t.get("weight_kg"))
    base = max(_f(terms.get("min_charge")), w * _f(terms.get("rate_per_kg")))
    expected = base * (1 + _f(terms.get("fuel_surcharge_pct")) / 100)
    acc = _f(t.get("accessorial_charged"))
    exp_acc = min(acc, _f(terms.get("max_accessorial")))
    lines = [_line(f"Linehaul + fuel ({w:,.0f} kg)", expected, _f(t.get("billed_amount"))),
             _line("Accessorial charges", exp_acc, acc)]
    tol = _f(terms.get("tolerance_amount"), 1)
    over = [ln for ln in lines if ln["variance"] > tol]
    leak = sum(ln["variance"] for ln in over)
    why = "; ".join(f"{ln['label'].split(' (')[0]} exceeds rate card by {ln['variance']:,.2f}" for ln in over)
    clause = f"Rate card: {terms.get('rate_per_kg')}/kg, fuel {terms.get('fuel_surcharge_pct')}%, min {terms.get('min_charge')}, accessorial cap {terms.get('max_accessorial')}"
    return leak, lines, why, clause, "RATE_OVERCHARGE"


EVALUATORS = {"MARKETPLACE_FEE": eval_marketplace, "RETAIL_DEDUCTION": eval_deduction,
              "PRICE_VARIANCE": eval_price, "REBATE": eval_rebate, "FREIGHT": eval_freight}


def txn_amount(t):
    d = t["domain"]
    if d == "MARKETPLACE_FEE":
        return sum(_f(t.get(k)) for k in ["referral_fee_charged", "fulfillment_fee_charged", "closing_fee_charged"])
    if d == "RETAIL_DEDUCTION":
        return _f(t.get("deduction_amount"))
    if d == "PRICE_VARIANCE":
        return _f(t.get("qty")) * _f(t.get("invoiced_unit_price"))
    if d == "REBATE":
        return _f(t.get("rebate_paid"))
    return _f(t.get("billed_amount")) + _f(t.get("accessorial_charged"))


def evaluate(txn: dict, terms: dict, duplicate: bool = False) -> dict | None:
    """Returns a finding dict or None when the transaction matches the contract."""
    if duplicate:
        amt = txn_amount(txn)
        return {"leak": round(amt, 2), "lines": [_line("Duplicate billing of same reference", 0, amt)],
                "reason": f"Reference {txn.get('ref')} was billed more than once — the repeat charge is not owed",
                "clause": "Each reference may be billed once (duplicate payment control)",
                "leak_type": "DUPLICATE_BILLING", "confidence": 0.97}
    leak, lines, reason, clause, leak_type = EVALUATORS[txn["domain"]](txn, terms)
    if leak <= 0:
        return None
    charged = sum(ln["actual"] for ln in lines) or 1
    ratio = leak / charged
    confidence = 0.96 if ratio > 0.05 else 0.88 if ratio > 0.01 else 0.74
    return {"leak": round(leak, 2), "lines": lines, "reason": reason, "clause": clause,
            "leak_type": leak_type, "confidence": confidence}


def severity(amount: float) -> str:
    return "high" if amount >= 1000 else "medium" if amount >= 250 else "low"
