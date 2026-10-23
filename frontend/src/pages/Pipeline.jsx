import { Link } from "react-router-dom";
import { useData } from "@/lib/api";
import { Money, PageHeader, DomainBadge, SeverityDot } from "@/components/common";
import { daysUntil, money } from "@/lib/format";

const COLS = [
  { key: "identified", label: "Identified", statuses: ["OPEN"], dot: "border-t-rose-500" },
  { key: "review", label: "Under review", statuses: ["IN_REVIEW"], dot: "border-t-sky-500" },
  { key: "escalated", label: "Escalated to senior", statuses: ["ESCALATED"], dot: "border-t-amber-500" },
  { key: "approved", label: "Approved · ready to send", statuses: ["APPROVED"], dot: "border-t-teal-500" },
  { key: "claim", label: "Claim with counterparty", statuses: ["CLAIM_SENT", "PARTIALLY_RECOVERED"], dot: "border-t-violet-500" },
  { key: "recovered", label: "Recovered", statuses: ["RECOVERED"], dot: "border-t-emerald-500" },
  { key: "closed", label: "Closed / denied", statuses: ["DENIED", "WRITTEN_OFF", "DISMISSED"], dot: "border-t-slate-400" },
];

const Card = ({ c }) => {
  const d = daysUntil(c.window_ends_at);
  return (
    <Link to={`/app/leakages/${c.id}`} data-testid={`pipeline-card-${c.number}`} className="block panel p-3 hover:-translate-y-0.5 hover:border-slate-400 transition-transform duration-150">
      <div className="flex justify-between items-center">
        <span className="num text-xs font-semibold text-slate-500 flex items-center gap-1.5"><SeverityDot severity={c.severity} />{c.number}</span>
        <DomainBadge domain={c.domain} />
      </div>
      <div className="text-sm font-semibold text-slate-900 mt-2 truncate">{c.counterparty_name}</div>
      <div className="flex justify-between items-end mt-2">
        <Money value={c.leak_amount} className="text-slate-900 text-sm" />
        {["OPEN", "IN_REVIEW", "ESCALATED", "APPROVED"].includes(c.status) && <span className={`num text-[10px] font-semibold ${d < 0 ? "text-rose-600" : d < 15 ? "text-amber-600" : "text-slate-400"}`}>{d < 0 ? "expired" : `${d}d`}</span>}
      </div>
      {c.recovered_amount > 0 && <div className="text-[11px] text-emerald-700 num font-semibold mt-1">+{money(c.recovered_amount)}</div>}
      <div className="text-[11px] text-slate-400 mt-2 truncate">{c.assignee_name ? `→ ${c.assignee_name}` : "Unassigned"}</div>
    </Link>
  );
};

export default function Pipeline() {
  const { data } = useData("/cases?sort=-leak_amount");
  return (
    <div>
      <PageHeader eyebrow="Recovery pipeline" title="From leak to cash" desc="Each stage is gated by role. Open a card to move it forward — every move is audit-logged." />
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="pipeline-board">
        {COLS.map((col) => {
          const items = (data || []).filter((c) => col.statuses.includes(c.status));
          const sum = items.reduce((s, c) => s + c.leak_amount, 0);
          return (
            <div key={col.key} className={`w-64 shrink-0 rounded-md bg-[#fbfbfc] border border-border border-t-2 ${col.dot}`} data-testid={`pipeline-col-${col.key}`}>
              <div className="p-3 border-b border-border">
                <div className="text-sm font-medium text-slate-900">{col.label}</div>
                <div className="text-[11px] text-slate-500 num mt-0.5">{items.length} · {money(sum)}</div>
              </div>
              <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">{items.map((c) => <Card key={c.id} c={c} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
