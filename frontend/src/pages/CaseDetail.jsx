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

const Breakdown = ({ c }) => (
  <Panel eyebrow="Expected vs charged" title="Calculation" testId="case-breakdown">
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-sm">
      {["Line", "Contract", "Charged", "Variance"].map((h) => <div key={h} className="eyebrow pb-2 border-b border-border">{h}</div>)}
      {c.lines.map((l) => (
        <div key={l.label} className="contents">
          <div className="py-2.5 border-b border-border text-slate-300">{l.label}</div>
          <div className="py-2.5 border-b border-border num text-slate-400 text-right">{money(l.expected, c.currency)}</div>
          <div className="py-2.5 border-b border-border num text-slate-200 text-right">{money(l.actual, c.currency)}</div>
          <div className={`py-2.5 border-b border-border num text-right ${l.variance > 0 ? "text-rose-300" : "text-slate-500"}`}>{l.variance > 0 ? "+" : ""}{money(l.variance, c.currency)}</div>
        </div>
      ))}
    </div>
    <div className="flex justify-between items-end mt-5">
      <div><div className="eyebrow">Recoverable</div><Money value={c.leak_amount} cur={c.currency} className="text-3xl text-white" /></div>
      <div className="text-right"><div className="eyebrow">Confidence</div><div className="num text-xl text-emerald-300" data-testid="case-confidence">{Math.round(c.confidence * 100)}%</div></div>
    </div>
    <p className="text-sm text-slate-300 mt-4 border-l-2 border-rose-500 pl-3" data-testid="case-reason">{c.reason}</p>
  </Panel>
);

const Txn = ({ t }) => (
  <Panel eyebrow="Source record" title="Transaction" testId="case-transaction">
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {Object.entries(t || {}).filter(([k]) => !["id", "seq", "counterparty_id", "batch_id", "evaluated", "case_id", "dup_key", "created_at", "sample", "rule_version"].includes(k)).map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-slate-500">{k.replace(/_/g, " ")}</dt><dd className="num text-slate-200 truncate">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd></div>
      ))}
    </dl>
  </Panel>
);

const Clause = ({ c }) => (
  <Panel eyebrow="Truth layer" title="Contract basis" testId="case-clause" action={<Scale className="h-4 w-4 text-cyan-400" />}>
    <div className="text-sm text-white">{c.rule_name}{c.rule_version && <span className="num text-xs text-slate-400 ml-2">v{c.rule_version}</span>}</div>
    <div className="text-xs text-cyan-300 mt-2 num">{c.clause}</div>
    {c.rule?.clause_text && <blockquote className="text-sm text-slate-400 italic mt-3 border-l-2 border-cyan-500/40 pl-3">“{c.rule.clause_text}”</blockquote>}
    {c.rule && <div className="text-[11px] text-slate-500 mt-3">Effective {fmtDate(c.rule.effective_from)} – {fmtDate(c.rule.effective_to)}</div>}
  </Panel>
);

const AssuranceBox = ({ c, onChange }) => {
  const api = useApi();
  const { can } = useMe();
  const [note, setNote] = useState("");
  const a = c.assurance;
  const act = async (verdict) => {
    try { onChange((await api.post(`/cases/${c.id}/assurance`, { verdict, note })).data); toast.success(`Assurance ${verdict.toLowerCase()}ed`); setNote(""); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel eyebrow="Independent check" title="Assurance" testId="case-assurance" action={a.verdict === "DISAGREE" ? <ShieldAlert className="h-4 w-4 text-rose-400" /> : <ShieldCheck className="h-4 w-4 text-violet-400" />}>
      <div className="text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-slate-400">Automated re-check</span><span className={a.auto === "CONFIRM" ? "text-emerald-300" : "text-rose-300"} data-testid="assurance-auto">{a.auto === "CONFIRM" ? "Matches" : "Mismatch"}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Reviewer verdict</span><span data-testid="assurance-verdict" className={a.verdict === "CONFIRM" ? "text-emerald-300" : a.verdict ? "text-rose-300" : "text-slate-500"}>{a.verdict ? `${a.verdict === "CONFIRM" ? "Confirmed" : "Disagreed"} · ${a.by}` : "Not reviewed"}</span></div>
        {a.note && <div className="text-xs text-slate-400 italic">“{a.note}”</div>}
        {c.needs_dual_control && <div className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-sm px-2 py-1.5 mt-2">Dual control: claims ≥ {money(c.dual_approval_threshold)} need Assurance confirmation before approval.</div>}
      </div>
      {can("adjudicate") && (
        <div className="mt-4 space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note (optional)" className="w-full bg-background border border-input rounded-sm px-3 py-2 text-sm" data-testid="assurance-note-input" />
          <div className="flex gap-2">
            <button onClick={() => act("CONFIRM")} data-testid="assurance-confirm-button" className="flex-1 px-3 py-2 text-sm rounded-sm bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25">Confirm</button>
            <button onClick={() => act("DISAGREE")} data-testid="assurance-disagree-button" className="flex-1 px-3 py-2 text-sm rounded-sm bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20">Disagree</button>
          </div>
        </div>
      )}
    </Panel>
  );
};

export default function CaseDetail() {
  const { id } = useParams();
  const { data: c, setData, error, reload } = useData(`/cases/${id}`);
  if (error) return <Empty title="Case not available" desc={error} />;
  if (!c) return <div className="eyebrow">Loading case…</div>;
  const d = daysUntil(c.window_ends_at);
  const update = () => reload();
  return (
    <div>
      <Link to="/app/leakages" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-4" data-testid="case-back-link"><ArrowLeft className="h-3 w-3" />Leakages</Link>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 rise">
        <div>
          <div className="flex items-center gap-3 flex-wrap"><span className="num text-emerald-400 text-sm" data-testid="case-number">{c.number}</span><StatusChip status={c.status} testId="case-status" /><DomainBadge domain={c.domain} /></div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white mt-2">{LEAK_TYPES[c.leak_type]} · {c.counterparty_name}</h1>
          <div className="text-sm text-slate-400 mt-1"><span className="num">{c.ref}</span> · {fmtDate(c.txn_date)} · {DOMAINS[c.domain]?.label}</div>
        </div>
        <div className="flex gap-6">
          <div><div className="eyebrow">Leakage</div><Money value={c.leak_amount} cur={c.currency} className="text-2xl text-rose-300" /></div>
          <div><div className="eyebrow">Recovered</div><Money value={c.recovered_amount} cur={c.currency} className="text-2xl text-emerald-300" /></div>
          <div><div className="eyebrow">Window</div><div className={`num text-2xl flex items-center gap-1 ${d < 0 ? "text-rose-400" : d < 15 ? "text-amber-300" : "text-white"}`} data-testid="case-window"><Clock className="h-4 w-4" />{d < 0 ? "Expired" : `${d}d`}</div></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <div className="lg:col-span-5 space-y-4"><Breakdown c={c} /><Txn t={c.transaction} /></div>
        <div className="lg:col-span-4 space-y-4"><Clause c={c} /><AssuranceBox c={c} onChange={setData} /><EmailDraft c={c} onChange={update} /></div>
        <div className="lg:col-span-3 space-y-4"><ActionPanel c={c} onChange={update} /><Activity c={c} onChange={update} /></div>
      </div>
    </div>
  );
}
