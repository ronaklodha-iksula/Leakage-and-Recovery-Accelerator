import { Link } from "react-router-dom";
import { useData } from "@/lib/api";
import { PageHeader, Panel, StatusChip, Money, Empty, DomainBadge } from "@/components/common";
import { fmtDateTime } from "@/lib/format";

const Row = ({ c, extra }) => (
  <Link to={`/app/leakages/${c.id}`} data-testid={`assurance-row-${c.number}`} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[90px_1fr_120px_130px] gap-3 items-center py-3 border-b border-border last:border-0 hover:bg-slate-800/40 px-2 -mx-2 rounded-sm">
    <span className="num text-emerald-300 text-sm">{c.number}</span>
    <div className="min-w-0"><div className="text-sm text-white truncate">{c.counterparty_name}</div><DomainBadge domain={c.domain} /></div>
    <Money value={c.leak_amount} className="text-white text-sm text-right" />
    <div className="hidden sm:block text-right">{extra || <StatusChip status={c.status} />}</div>
  </Link>
);

export default function Assurance() {
  const settings = useData("/settings").data;
  const { data } = useData("/cases?status=OPEN,IN_REVIEW,ESCALATED,APPROVED,CLAIM_SENT,PARTIALLY_RECOVERED,RECOVERED&sort=-leak_amount");
  if (!data || !settings) return <div className="eyebrow">Loading assurance…</div>;
  const t = settings.dual_approval_threshold;
  const open = ["OPEN", "IN_REVIEW", "ESCALATED"];
  const dual = data.filter((c) => open.includes(c.status) && c.leak_amount >= t && !c.assurance.verdict);
  const mismatch = data.filter((c) => c.assurance.auto !== "CONFIRM" || c.assurance.verdict === "DISAGREE");
  const done = data.filter((c) => c.assurance.verdict).slice(0, 15);
  const confirmed = data.filter((c) => c.assurance.verdict === "CONFIRM").length;
  const rate = data.length ? Math.round((data.filter((c) => c.assurance.auto === "CONFIRM").length / data.length) * 100) : 0;
  return (
    <div>
      <PageHeader eyebrow="Who audits the agents" title="Assurance" desc={`Independent verification of every finding. Claims ≥ $${t.toLocaleString()} require an Assurance reviewer's confirmation before an Approver can approve them.`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[["Awaiting dual control", dual.length, "text-violet-300"], ["Auto re-check agreement", `${rate}%`, "text-emerald-300"], ["Reviewer confirmed", confirmed, "text-white"], ["Disagreements", mismatch.length, "text-rose-300"]].map(([l, v, tone]) => (
          <div key={l} className="panel p-5" data-testid={`assurance-kpi-${l.split(" ")[0].toLowerCase()}`}><div className="eyebrow">{l}</div><div className={`num text-3xl mt-3 ${tone}`}>{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel eyebrow="Queue" title="Needs dual-control sign-off" testId="assurance-queue">
          {!dual.length ? <Empty title="Queue is clear" desc="No high-value case is waiting for review." testId="assurance-queue-empty" /> : dual.map((c) => <Row key={c.id} c={c} />)}
        </Panel>
        <Panel eyebrow="Exceptions" title="Disagreements & mismatches" testId="assurance-mismatch">
          {!mismatch.length ? <div className="text-sm text-slate-500">No disagreements — every finding re-computes identically.</div> : mismatch.map((c) => <Row key={c.id} c={c} />)}
        </Panel>
        <Panel className="lg:col-span-2" eyebrow="Log" title="Recently adjudicated" testId="assurance-done">
          {done.map((c) => <Row key={c.id} c={c} extra={<span className={`text-xs ${c.assurance.verdict === "CONFIRM" ? "text-emerald-300" : "text-rose-300"}`}>{c.assurance.verdict} · {c.assurance.by}<div className="text-[10px] text-slate-500 num">{fmtDateTime(c.assurance.at)}</div></span>} />)}
        </Panel>
      </div>
    </div>
  );
}
