import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, useData, downloadFile, errMsg } from "@/lib/api";
import { DOMAINS, STATUS, LEAK_TYPES, fmtDate, daysUntil, money } from "@/lib/format";
import { PageHeader, StatusChip, DomainBadge, Money, Empty, SeverityDot } from "@/components/common";

const F = ({ value, onChange, placeholder, items, testId }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-full sm:w-44 bg-white rounded-lg" data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger>
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
    ["status", "domain", "counterparty_id", "assignee", "severity", "q"].forEach((k) => sp.get(k) && p.set(k, sp.get(k)));
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
      <PageHeader eyebrow="Detection results" title="Leakages" desc="Every transaction that deviates from the agreed terms — partners, suppliers and customers. Open a case to investigate, escalate or recover.">
        <button onClick={exportCsv} data-testid="export-csv-button" className="btn-secondary"><Download className="h-4 w-4" />Export CSV</button>
      </PageHeader>
      <div className="panel p-3 flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        <form className="relative flex-1 min-w-[220px]" onSubmit={(e) => { e.preventDefault(); set("q")(q || "all"); }}>
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search case #, invoice, order, counterparty… (Enter)" className="field pl-9" data-testid="leakage-search-input" />
        </form>
        <F testId="filter-status" value={get("status")} onChange={set("status")} placeholder="All statuses" items={Object.entries(STATUS).map(([k, v]) => [k, v.label])} />
        <F testId="filter-domain" value={get("domain")} onChange={set("domain")} placeholder="All scenarios" items={Object.entries(DOMAINS).map(([k, v]) => [k, v.label])} />
        <F testId="filter-counterparty" value={get("counterparty_id")} onChange={set("counterparty_id")} placeholder="All counterparties" items={cps.map((c) => [c.id, c.name])} />
        <F testId="filter-assignee" value={get("assignee")} onChange={set("assignee")} placeholder="Anyone" items={[["me", "Assigned to me"], ["unassigned", "Unassigned"]]} />
        <F testId="filter-severity" value={get("severity")} onChange={set("severity")} placeholder="Any severity" items={[["high", "High"], ["medium", "Medium"], ["low", "Low"]]} />
      </div>
      <div className="text-sm text-slate-500 mb-3" data-testid="leakage-summary"><span className="font-semibold text-slate-800">{data?.length ?? 0}</span> cases · <span className="num font-semibold text-amber-700">{money(total)}</span> outstanding</div>
      {!loading && !data?.length ? <Empty title="No leakages match these filters" desc="Try clearing a filter or upload new data." /> : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm" data-testid="leakages-table">
            <thead><tr>{["Case", "Counterparty", "Type", "Reference", "Leakage", "Recovered", "Status", "Owner", "Window"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {(data || []).map((c) => {
                const d = daysUntil(c.window_ends_at);
                return (
                  <tr key={c.id} className="tr" data-testid={`leakage-row-${c.number}`}>
                    <td className="px-4 py-3 whitespace-nowrap"><Link to={`/app/leakages/${c.id}`} className="num font-semibold text-emerald-700 hover:underline flex items-center gap-2" data-testid={`leakage-link-${c.number}`}><SeverityDot severity={c.severity} />{c.number}</Link></td>
                    <td className="px-4 py-3 whitespace-nowrap"><div className="font-medium text-slate-900">{c.counterparty_name}</div><DomainBadge domain={c.domain} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{LEAK_TYPES[c.leak_type] || c.leak_type}</td>
                    <td className="px-4 py-3 whitespace-nowrap num text-xs text-slate-600">{c.ref}<div className="text-slate-400">{fmtDate(c.txn_date)}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Money value={c.leak_amount} cur={c.currency} className="text-slate-900" /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><Money value={c.recovered_amount} cur={c.currency} className={c.recovered_amount ? "text-emerald-700" : "text-slate-300"} /></td>
                    <td className="px-4 py-3"><StatusChip status={c.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">{c.assignee_name || <span className="text-slate-400">Unassigned</span>}</td>
                    <td className={`px-4 py-3 whitespace-nowrap num text-xs font-semibold ${d < 0 ? "text-rose-600" : d < 15 ? "text-amber-600" : "text-slate-500"}`}>{d < 0 ? "Expired" : `${d}d`}</td>
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
