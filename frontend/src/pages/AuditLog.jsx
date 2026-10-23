import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useData } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/common";

export default function AuditLog() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const { data } = useData(`/audit?q=${encodeURIComponent(applied)}`);
  return (
    <div>
      <PageHeader eyebrow="Immutable" title="Audit log" desc="Every detection, status change, assignment, email and rule publication — who, what, when." />
      <form onSubmit={(e) => { e.preventDefault(); setApplied(q); }} className="relative max-w-md mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by action or detail… (Enter)" className="field pl-9" data-testid="audit-search-input" />
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm" data-testid="audit-table">
          <thead><tr>{["When", "Actor", "Role", "Action", "Detail"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {(data || []).map((e) => (
              <tr key={e.id} className="tr">
                <td className="px-4 py-2.5 num text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(e.ts)}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{e.actor_name}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{e.actor_role}</td>
                <td className="px-4 py-2.5 num text-xs font-semibold text-emerald-700 whitespace-nowrap">{e.entity === "case" && e.entity_id !== "*" ? <Link to={`/app/leakages/${e.entity_id}`} className="hover:underline">{e.action}</Link> : e.action}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xl truncate">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
