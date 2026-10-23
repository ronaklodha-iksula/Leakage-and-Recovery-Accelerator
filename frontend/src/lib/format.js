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

export const GROUPS = ["Partner & channel", "Procurement & payables", "Revenue & receivables"];

export const DOMAINS = {
  MARKETPLACE_FEE: { label: "Marketplace fees", short: "Marketplace", color: "#0284C7", group: GROUPS[0] },
  RETAIL_DEDUCTION: { label: "Retail deductions (OTIF)", short: "OTIF", color: "#2563EB", group: GROUPS[0] },
  PAYMENT_PROCESSING: { label: "Payment processing fees", short: "Processing", color: "#4F46E5", group: GROUPS[0] },
  PRICE_VARIANCE: { label: "Supplier price variance", short: "Price", color: "#D97706", group: GROUPS[1] },
  FREIGHT: { label: "Freight overcharge", short: "Freight", color: "#EA580C", group: GROUPS[1] },
  AP_PAYMENT: { label: "Vendor overpayments", short: "AP", color: "#DC2626", group: GROUPS[1] },
  SAAS_LICENSE: { label: "SaaS & licenses", short: "SaaS", color: "#9333EA", group: GROUPS[1] },
  AR_RECEIVABLE: { label: "Customer short payments", short: "Receivables", color: "#059669", group: GROUPS[2] },
  REBATE: { label: "Rebate shortfall", short: "Rebate", color: "#0D9488", group: GROUPS[2] },
  ROYALTY: { label: "Royalty underpayment", short: "Royalty", color: "#0891B2", group: GROUPS[2] },
};

export const STATUS = {
  OPEN: { label: "Identified", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  IN_REVIEW: { label: "Under review", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  ESCALATED: { label: "Escalated", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  CLAIM_SENT: { label: "Claim sent", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  PARTIALLY_RECOVERED: { label: "Partially recovered", cls: "bg-teal-50 text-teal-800 border-teal-200" },
  RECOVERED: { label: "Recovered", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  DENIED: { label: "Denied", cls: "bg-red-50 text-red-800 border-red-200" },
  DISMISSED: { label: "Dismissed", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  WRITTEN_OFF: { label: "Written off", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

export const LEAK_TYPES = {
  FEE_OVERCHARGE: "Fee overcharge",
  INVALID_DEDUCTION: "Invalid deduction",
  PRICE_OVERBILL: "Price overbilling",
  REBATE_SHORTFALL: "Rebate shortfall",
  RATE_OVERCHARGE: "Rate overcharge",
  DUPLICATE_BILLING: "Duplicate billing / payment",
  SHORT_PAYMENT: "Customer short payment",
  UNPAID_OVERDUE: "Overdue unpaid invoice",
  UNEARNED_DISCOUNT: "Unearned early-pay discount",
  LATE_INTEREST: "Unbilled late interest",
  OVERPAYMENT: "Vendor overpayment",
  SEAT_OVERBILLING: "License overbilling",
  PROCESSING_OVERCHARGE: "Processing fee overcharge",
  ROYALTY_SHORTFALL: "Royalty underpayment",
};
