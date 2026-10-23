import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useApi, useData, downloadFile, errMsg } from "@/lib/api";
import { DOMAINS, STATUS, LEAK_TYPES, fmtDate, daysUntil } from "@/lib/format";
import { PageHeader, StatusChip, DomainBadge, Money, Empty, SeverityDot } from "@/components/common";

const F = ({ value, onChange, placeholder, items, testId }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-full sm:w-44 bg-card" data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{placeholder}</SelectItem>
      {items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default function Leakages() {
  const api = useApi();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const get = (k) => sp.get(k) || "all";
  const set = (k) => (v) => { const n = new URLSearchParams(sp); v === "all" ? n.delete(k) : n.set(k, v); setSp(n); };
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    ["status", "domain", "counterparty_id", "assignee", "severity"].forEach((k) => sp.get(k) && p.set(k, sp.get(k)));
    if (sp.get("q")) p.set("q", sp.get("q"));
    p.set("sort", sp.get("sort") || "-leak_amount");
    return p.toString();
  }, [sp]);
  const { data, loading } = useData(`/cases?${qs}`);
  const cps = useData("/counterparties").data || [];
  const total = (data || []).reduce((s, c) => s + c.leak_amount - (c.recovered_amount || 0), 0);
  const exportCsv = async () => {
    try { await downloadFile(api, "/cases/export.csv", "leakage-cases.csv"); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <PageHeader eyebrow="Detection results" title="Leakages" desc="Every transaction that deviates from the published contract terms. Open a case to investigate, escalate or recover.">
        <button onClick={exportCsv} data-testid="export-csv-button" className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-sm border border-border hover:bg-slate-800 hover:text-white"><Download className="h-4 w-4" />Export CSV</button>
      </PageHeader>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        <form className="relative flex-1 min-w-[220px]" onSubmit={(e) => { e.preventDefault(); set("q")(q || "all"); }}>
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search case #, order, invoice, counterparty…" className="pl-9 bg-card" data-testid="leakage-search-input" />
        </form>
        <F testId="filter-status" value={get("status")} onChange={set("status")} placeholder="All statuses" items={Object.entries(STATUS).map(([k, v]) => [k, v.label])} />
        <F testId="filter-domain" value={get("domain")} onChange={set("domain")} placeholder="All domains" items={Object.entries(DOMAINS).map(([k, v]) => [k, v.label])} />
        <F testId="filter-counterparty" value={get("counterparty_id")} onChange={set("counterparty_id")} placeholder="All counterparties" items={cps.map((c) => [c.id, c.name])} />
        <F testId="filter-assignee" value={get("assignee")} onChange={set("assignee")} placeholder="Anyone" items={[["me", "Assigned to me"], ["unassigned", "Unassigned"]]} />
        <F testId="filter-severity" value={get("severity")} onChange={set("severity")} placeholder="Any severity" items={[["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
      </div>
      <div className="text-xs text-slate-400 mb-3" data-testid="leakage-summary">{data?.length ?? 0} cases · <span className="num text-rose-300">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}</span> outstanding</div>
      {!loading && !data?.length ? <Empty title="No leakages match these filters" desc="Try clearing a filter or upload new data." /> : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm" data-testid="leakages-table">
            <thead>
              <tr className="text-left border-b border-border">
                {["Case", "Counterparty", "Type", "Reference", "Leakage", "Recovered", "Status", "Assignee", "Window"].map((h) => <th key={h} className="eyebrow font-normal px-4 py-3 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(data || []).map((c) => {
                const d = daysUntil(c.window_ends_at);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-slate-800/40 border-l-2 border-l-transparent hover:border-l-emerald-500 transition-colors" data-testid={`leakage-row-${c.number}`}>
                    <td className="px-4 py-3 whitespace-nowrap"><Link to={`/app/leakages/${c.id}`} className="num text-emerald-300 hover:underline flex items-center gap-2" data-testid={`leakage-link-${c.number}`}><SeverityDot severity={c.severity} />{c.number}</Link></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-200">{c.counterparty_name}<div><DomainBadge domain={c.domain} /></div></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300">{LEAK_TYPES[c.leak_type] || c.leak_type}</td>
                    <td className="px-4 py-3 whitespace-nowrap num text-xs text-slate-400">{c.ref}<div className="text-slate-500">{fmtDate(c.txn_date)}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Money value={c.leak_amount} cur={c.currency} className="text-white" /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Money value={c.recovered_amount} cur={c.currency} className={c.recovered_amount ? "text-emerald-300" : "text-slate-600"} /></td>
                    <td className="px-4 py-3"><StatusChip status={c.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300 text-xs">{c.assignee_name || <span className="text-slate-600">Unassigned</span>}</td>
                    <td className={`px-4 py-3 whitespace-nowrap num text-xs ${d < 0 ? "text-rose-400" : d < 15 ? "text-amber-300" : "text-slate-400"}`}>{d < 0 ? "Expired" : `${d}d`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
