import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Scale, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import { useApi, useData, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { DOMAINS, LEAK_TYPES, daysUntil, fmtDate, money } from "@/lib/format";
import { Panel, StatusChip, DomainBadge, Money, Empty } from "@/components/common";
import ActionPanel from "@/components/case/ActionPanel";
import EmailDraft from "@/components/case/EmailDraft";
import Activity from "@/components/case/Activity";

const HIDE = ["id", "seq", "counterparty_id", "batch_id", "evaluated", "case_id", "dup_key", "created_at", "sample", "rule_version"];
const bad = (l) => (l.dir === "under" ? l.variance < 0 : l.variance > 0);

const Breakdown = ({ c }) => (
  <Panel eyebrow="Expected vs actual" title="Calculation" testId="case-breakdown">
    <div className="overflow-x-auto">
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-sm min-w-[440px]">
      {["Line", "Per contract", "Actual", "Variance"].map((h) => <div key={h} className="eyebrow pb-2 border-b border-slate-200">{h}</div>)}
      {c.lines.map((l) => (
        <div key={l.label} className="contents">
          <div className="py-2.5 border-b border-slate-100 text-slate-700">{l.label}</div>
          <div className="py-2.5 border-b border-slate-100 num text-slate-500 text-right">{money(l.expected, c.currency)}</div>
          <div className="py-2.5 border-b border-slate-100 num text-slate-900 text-right">{money(l.actual, c.currency)}</div>
          <div className={`py-2.5 border-b border-slate-100 num font-semibold text-right ${bad(l) ? "text-rose-600" : "text-slate-400"}`}>{l.variance > 0 ? "+" : ""}{money(l.variance, c.currency)}</div>
        </div>
      ))}
    </div>
    </div>
    <div className="flex justify-between items-end mt-5">
      <div><div className="eyebrow">Recoverable</div><Money value={c.leak_amount} cur={c.currency} className="text-3xl text-slate-900" /></div>
      <div className="text-right"><div className="eyebrow">Confidence</div><div className="num text-xl font-bold text-emerald-700" data-testid="case-confidence">{Math.round(c.confidence * 100)}%</div></div>
    </div>
    <p className="text-sm text-slate-700 mt-4 border-l-2 border-rose-400 pl-3" data-testid="case-reason">{c.reason}</p>
  </Panel>
);

const Txn = ({ t }) => (
  <Panel eyebrow="Source record" title="Transaction" testId="case-transaction">
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {Object.entries(t || {}).filter(([k]) => !HIDE.includes(k)).map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-slate-500 capitalize">{k.replace(/_/g, " ")}</dt><dd className="num text-slate-800 truncate">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd></div>
      ))}
    </dl>
  </Panel>
);

const Clause = ({ c }) => (
  <Panel eyebrow="Truth layer" title="Contract basis" testId="case-clause" action={<Scale className="h-4 w-4 text-sky-600" />}>
    <div className="text-sm font-semibold text-slate-900">{c.rule_name}{c.rule_version && <span className="num text-xs text-slate-400 ml-2">v{c.rule_version}</span>}</div>
    <div className="text-xs text-sky-700 bg-sky-50 rounded-md px-2 py-1.5 mt-2 num">{c.clause}</div>
    {c.rule?.clause_text && <blockquote className="text-sm text-slate-500 italic mt-3 border-l-2 border-sky-200 pl-3">“{c.rule.clause_text}”</blockquote>}
    {c.rule && <div className="text-[11px] text-slate-400 mt-3">Effective {fmtDate(c.rule.effective_from)} – {fmtDate(c.rule.effective_to)}</div>}
  </Panel>
);

const AssuranceBox = ({ c, onChange }) => {
  const api = useApi();
  const { can } = useMe();
  const [note, setNote] = useState("");
  const a = c.assurance;
  const act = async (verdict) => {
    try { await api.post(`/cases/${c.id}/assurance`, { verdict, note }); onChange(); toast.success(`Assurance ${verdict.toLowerCase()}ed`); setNote(""); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel eyebrow="Independent check" title="Assurance" testId="case-assurance" action={a.verdict === "DISAGREE" ? <ShieldAlert className="h-4 w-4 text-rose-500" /> : <ShieldCheck className="h-4 w-4 text-indigo-500" />}>
      <div className="text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-slate-500">Automated re-check</span><span className={`font-semibold ${a.auto === "CONFIRM" ? "text-emerald-700" : "text-rose-600"}`} data-testid="assurance-auto">{a.auto === "CONFIRM" ? "Matches" : "Mismatch"}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Reviewer verdict</span><span data-testid="assurance-verdict" className={`font-semibold ${a.verdict === "CONFIRM" ? "text-emerald-700" : a.verdict ? "text-rose-600" : "text-slate-400"}`}>{a.verdict ? `${a.verdict === "CONFIRM" ? "Confirmed" : "Disagreed"} · ${a.by}` : "Not reviewed"}</span></div>
        {a.note && <div className="text-xs text-slate-500 italic">“{a.note}”</div>}
        {c.needs_dual_control && <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-sm px-2.5 py-2 mt-2">Dual control: claims ≥ {money(c.dual_approval_threshold)} need Assurance confirmation before approval.</div>}
      </div>
      {can("adjudicate") && (
        <div className="mt-4 space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note (optional)" className="field" data-testid="assurance-note-input" />
          <div className="flex gap-2">
            <button onClick={() => act("CONFIRM")} data-testid="assurance-confirm-button" className="btn-soft flex-1">Confirm</button>
            <button onClick={() => act("DISAGREE")} data-testid="assurance-disagree-button" className="btn-danger flex-1">Disagree</button>
          </div>
        </div>
      )}
    </Panel>
  );
};

export default function CaseDetail() {
  const { id } = useParams();
  const { data: c, error, reload } = useData(`/cases/${id}`);
  if (error) return <Empty title="Case not available" desc={error} />;
  if (!c) return <div className="eyebrow">Loading case…</div>;
  const d = daysUntil(c.window_ends_at);
  return (
    <div>
      <Link to="/app/leakages" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 mb-4" data-testid="case-back-link"><ArrowLeft className="h-3 w-3" />Leakages</Link>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 rise">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap"><span className="num font-semibold text-emerald-700 text-sm" data-testid="case-number">{c.number}</span><StatusChip status={c.status} testId="case-status" /><DomainBadge domain={c.domain} /></div>
          <h1 className="text-3xl sm:text-4xl font-semibold mt-2">{LEAK_TYPES[c.leak_type] || c.leak_type} · {c.counterparty_name}</h1>
          <div className="text-sm text-slate-500 mt-1"><span className="num">{c.ref}</span> · {fmtDate(c.txn_date)} · {DOMAINS[c.domain]?.label}</div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div><div className="eyebrow">Leakage</div><Money value={c.leak_amount} cur={c.currency} className="text-2xl text-rose-600" /></div>
          <div><div className="eyebrow">Recovered</div><Money value={c.recovered_amount} cur={c.currency} className="text-2xl text-emerald-600" /></div>
          <div><div className="eyebrow">Window</div><div className={`num text-2xl flex items-center gap-1 ${d < 0 ? "text-rose-600" : d < 15 ? "text-amber-600" : "text-slate-900"}`} data-testid="case-window"><Clock className="h-4 w-4" />{d < 0 ? "Expired" : `${d}d`}</div></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <div className="lg:col-span-5 space-y-4"><Breakdown c={c} /><Txn t={c.transaction} /></div>
        <div className="lg:col-span-4 space-y-4"><Clause c={c} /><AssuranceBox c={c} onChange={reload} /><EmailDraft c={c} onChange={reload} /></div>
        <div className="lg:col-span-3 space-y-4"><ActionPanel c={c} onChange={reload} /><Activity c={c} onChange={reload} /></div>
      </div>
    </div>
  );
}
