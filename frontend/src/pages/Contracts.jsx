import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, Pencil, Upload as PublishIcon, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, useData, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { DOMAINS, fmtDate } from "@/lib/format";
import { PageHeader, DomainBadge, Empty } from "@/components/common";

const RS = { PUBLISHED: "text-emerald-800 border-emerald-200 bg-emerald-50", DRAFT: "text-amber-800 border-amber-200 bg-amber-50", RETIRED: "text-slate-500 border-slate-200 bg-slate-100" };

const RuleEditor = ({ rule, onClose, onSaved }) => {
  const api = useApi();
  const cps = useData("/counterparties").data || [];
  const domainsRaw = useData("/domains").data;
  const domains = useMemo(() => domainsRaw || [], [domainsRaw]);
  const [f, setF] = useState(rule || { name: "", counterparty_id: "", domain: "MARKETPLACE_FEE", effective_from: "2026-01-01", effective_to: "2026-12-31", source_ref: "", clause_text: "", terms: null });
  const [terms, setTerms] = useState(JSON.stringify(rule?.terms || {}, null, 2));
  const [contract, setContract] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));
  const pickDomain = (d) => { set("domain")(d); if (!rule) setTerms(JSON.stringify(domains.find((x) => x.key === d)?.default_terms || {}, null, 2)); };
  useEffect(() => {
    if (!rule && domains.length) setTerms((t) => (t === "{}" ? JSON.stringify(domains.find((x) => x.key === "MARKETPLACE_FEE")?.default_terms || {}, null, 2) : t));
  }, [domains, rule]);
  const extract = async () => {
    setBusy(true);
    try {
      const r = (await api.post("/ai/extract-rule", { domain: f.domain, text: contract })).data;
      setTerms(JSON.stringify(r.terms, null, 2));
      if (r.clause) set("clause_text")(r.clause);
      toast.success("Terms extracted — verify before saving", { description: r.notes?.slice(0, 160) });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    let parsed;
    try { parsed = JSON.parse(terms); } catch { return toast.error("Terms must be valid JSON"); }
    setBusy(true);
    try {
      const body = { ...f, terms: parsed };
      const r = rule ? await api.put(`/rules/${rule.id}`, body) : await api.post("/rules", body);
      toast.success(rule?.status === "PUBLISHED" ? `Saved as new draft v${r.data.version}` : "Draft saved");
      onSaved();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="rule-editor-dialog">
        <DialogHeader><DialogTitle>{rule ? `Edit ${rule.name} (v${rule.version})` : "New contract rule"}</DialogTitle></DialogHeader>
        {rule?.status === "PUBLISHED" && <div className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">Published rules are immutable — saving creates a new draft version.</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="field" placeholder="Rule name (e.g. Amazon Fee Schedule 2027)" value={f.name} onChange={set("name")} data-testid="rule-name-input" />
          <Select value={f.counterparty_id} onValueChange={set("counterparty_id")}>
            <SelectTrigger data-testid="rule-counterparty-select" className="rounded-lg"><SelectValue placeholder="Counterparty" /></SelectTrigger>
            <SelectContent>{cps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.domain} onValueChange={pickDomain}>
            <SelectTrigger data-testid="rule-domain-select" className="rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(DOMAINS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
          </Select>
          <input className="field" placeholder="Source document reference" value={f.source_ref} onChange={set("source_ref")} data-testid="rule-source-input" />
          <label className="text-xs font-medium text-slate-500">Effective from<input type="date" className="field mt-1" value={f.effective_from} onChange={set("effective_from")} data-testid="rule-from-input" /></label>
          <label className="text-xs font-medium text-slate-500">Effective to<input type="date" className="field mt-1" value={f.effective_to} onChange={set("effective_to")} data-testid="rule-to-input" /></label>
        </div>
        <textarea className="field" rows={2} placeholder="Clause text quoted from the contract" value={f.clause_text} onChange={set("clause_text")} data-testid="rule-clause-input" />
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5 mb-2"><Sparkles className="h-3.5 w-3.5" />AI contract reader — paste agreement / T&amp;C text to auto-fill terms</div>
          <textarea className="field" rows={4} value={contract} onChange={(e) => setContract(e.target.value)} placeholder="e.g. 'Referral fees: Kitchen 15%, Electronics 8%… Net 30, 2% discount if paid within 10 days…'" data-testid="rule-contract-text-input" />
          <button onClick={extract} disabled={busy || contract.length < 30} data-testid="rule-ai-extract-button" className="btn-ai mt-2">{busy ? "Reading…" : "Extract terms"}</button>
        </div>
        <div>
          <div className="eyebrow mb-1">Executable terms (JSON)</div>
          <textarea className="field num text-xs bg-slate-50" rows={10} value={terms} onChange={(e) => setTerms(e.target.value)} data-testid="rule-terms-input" />
        </div>
        <DialogFooter>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy || !f.name || !f.counterparty_id} data-testid="rule-save-button" className="btn-primary">Save draft</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TermList = ({ terms }) => (
  <div className="text-xs num space-y-1 mt-3 rounded-lg bg-slate-50 p-3">
    {Object.entries(terms).slice(0, 6).map(([k, v]) => (
      <div key={k} className="flex gap-2"><span className="text-slate-400 shrink-0">{k.replace(/_/g, " ")}</span><span className="text-slate-700 truncate">{typeof v === "object" ? JSON.stringify(v).replace(/[{}"[\]]/g, "").replace(/,/g, ", ") : String(v)}</span></div>
    ))}
  </div>
);

export default function Contracts() {
  const api = useApi();
  const { can } = useMe();
  const { data, reload } = useData("/rules");
  const [edit, setEdit] = useState(null);
  const act = async (r, a) => {
    try { const res = (await api.post(`/rules/${r.id}/${a}`)).data; toast.success(a === "publish" ? `Published v${r.version}${res.requeued ? ` · ${res.requeued} pending rows re-queued` : ""}` : "Retired"); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <PageHeader eyebrow="Truth layer" title="Contracts & terms" desc="Versioned, machine-executable terms — fee schedules, price lists, payment terms, rate cards, order forms and license agreements. Detection uses the published version effective on each transaction date.">
        {can("author_rule") && <button onClick={() => setEdit({})} data-testid="new-rule-button" className="btn-primary"><Plus className="h-4 w-4" />New rule</button>}
      </PageHeader>
      {!data?.length ? <Empty title="No contract rules yet" /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((r) => (
            <div key={r.id} className="panel p-5 flex flex-col hover:shadow-md transition-shadow duration-200 relative overflow-hidden" data-testid={`rule-card-${r.id}`}>
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: DOMAINS[r.domain]?.color }} />
              <div className="flex justify-between items-start gap-2">
                <DomainBadge domain={r.domain} />
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${RS[r.status]}`} data-testid={`rule-status-${r.id}`}>{r.status} · v{r.version}</span>
              </div>
              <div className="font-bold text-slate-900 mt-3" style={{ fontFamily: "Outfit" }}>{r.name}</div>
              <div className="text-xs text-slate-500">{r.counterparty_name} · {fmtDate(r.effective_from)} – {fmtDate(r.effective_to)}</div>
              <TermList terms={r.terms} />
              <div className="flex gap-2 mt-auto pt-4">
                {can("author_rule") && r.status !== "RETIRED" && <button onClick={() => setEdit(r)} data-testid={`rule-edit-${r.id}`} className="btn-secondary px-2.5 py-1.5 text-xs"><Pencil className="h-3 w-3" />{r.status === "PUBLISHED" ? "New version" : "Edit"}</button>}
                {can("publish_rule") && r.status === "DRAFT" && <button onClick={() => act(r, "publish")} data-testid={`rule-publish-${r.id}`} className="btn-soft px-2.5 py-1.5 text-xs"><PublishIcon className="h-3 w-3" />Publish</button>}
                {can("publish_rule") && r.status === "PUBLISHED" && <button onClick={() => act(r, "retire")} data-testid={`rule-retire-${r.id}`} className="btn-ghost px-2.5 py-1.5 text-xs"><Archive className="h-3 w-3" />Retire</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <RuleEditor rule={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}
