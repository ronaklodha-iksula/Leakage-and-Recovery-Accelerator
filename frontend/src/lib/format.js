export const money = (n, cur = "USD", compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cur || "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n || 0);

export const fmtDate = (s) => (s ? new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
export const fmtDateTime = (s) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const daysUntil = (s) => Math.ceil((new Date(s + "T00:00:00") - new Date()) / 86400000);

export const DOMAINS = {
  MARKETPLACE_FEE: { label: "Marketplace fees", short: "Marketplace", color: "#3b82f6" },
  RETAIL_DEDUCTION: { label: "Retail deductions (OTIF)", short: "OTIF", color: "#ec4899" },
  PRICE_VARIANCE: { label: "Supplier price variance", short: "Price", color: "#06b6d4" },
  REBATE: { label: "Rebate shortfall", short: "Rebate", color: "#8b5cf6" },
  FREIGHT: { label: "Freight overcharge", short: "Freight", color: "#f97316" },
};

export const STATUS = {
  OPEN: { label: "Identified", cls: "text-rose-300 bg-rose-500/10 border-rose-500/25" },
  IN_REVIEW: { label: "Under review", cls: "text-sky-300 bg-sky-500/10 border-sky-500/25" },
  ESCALATED: { label: "Escalated", cls: "text-amber-300 bg-amber-500/10 border-amber-500/25" },
  APPROVED: { label: "Approved", cls: "text-teal-300 bg-teal-500/10 border-teal-500/25" },
  CLAIM_SENT: { label: "Claim sent", cls: "text-violet-300 bg-violet-500/10 border-violet-500/25" },
  PARTIALLY_RECOVERED: { label: "Partially recovered", cls: "text-lime-300 bg-lime-500/10 border-lime-500/25" },
  RECOVERED: { label: "Recovered", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" },
  DENIED: { label: "Denied", cls: "text-orange-300 bg-orange-500/10 border-orange-500/25" },
  DISMISSED: { label: "Dismissed", cls: "text-slate-400 bg-slate-500/10 border-slate-500/25" },
  WRITTEN_OFF: { label: "Written off", cls: "text-slate-400 bg-slate-500/10 border-slate-500/25" },
};

export const LEAK_TYPES = {
  FEE_OVERCHARGE: "Fee overcharge",
  INVALID_DEDUCTION: "Invalid deduction",
  PRICE_OVERBILL: "Price overbilling",
  REBATE_SHORTFALL: "Rebate shortfall",
  RATE_OVERCHARGE: "Rate overcharge",
  DUPLICATE_BILLING: "Duplicate billing",
};
