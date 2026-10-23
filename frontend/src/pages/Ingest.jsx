import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, Download, Play, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, useData, downloadFile, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { DOMAINS, GROUPS, fmtDateTime, money } from "@/lib/format";
import { PageHeader, Panel, DomainBadge } from "@/components/common";

const RESULT = { LEAK: "text-rose-600 bg-rose-50", MATCHED: "text-emerald-700 bg-emerald-50", NO_RULE: "text-amber-700 bg-amber-50" };

export default function Ingest() {
  const api = useApi();
  const { can } = useMe();
  const [domain, setDomain] = useState("MARKETPLACE_FEE");
  const [cp, setCp] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef();
  const cps = useData("/counterparties").data || [];
  const domains = useData("/domains").data || [];
  const batches = useData("/batches");
  const txns = useData("/transactions?limit=40");
  const info = domains.find((d) => d.key === domain);
  const upload = async () => {
    const fd = new FormData();
    fd.append("file", file); fd.append("domain", domain); fd.append("counterparty_id", cp);
    setBusy(true);
    try {
      const r = (await api.post("/ingest", fd)).data;
      const d = r.detection;
      toast.success(`${r.inserted} rows ingested${r.skipped ? `, ${r.skipped} already loaded` : ""}${d ? ` · ${d.leaks} leaks found (${money(d.amount)})` : ""}`);
      setFile(null); batches.reload(); txns.reload();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const detect = async () => {
    try { const s = (await api.post("/detect", {})).data; toast.success(`Evaluated ${s.evaluated} · ${s.leaks} new leaks · ${money(s.amount)}`); batches.reload(); txns.reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <PageHeader eyebrow="Ingest" title="Data ingestion" desc="Upload marketplace settlements, deduction notices, supplier & carrier invoices, AP payment runs, AR ledgers, SaaS bills or royalty statements (CSV or Excel). Each row is checked against the counterparty's published terms.">
        {can("detect") && <button onClick={detect} data-testid="run-detection-button" className="btn-secondary"><Play className="h-4 w-4" />Run detection on pending</button>}
      </PageHeader>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel className="lg:col-span-5" eyebrow="Upload" title="Add a data file" testId="upload-panel">
          {!can("upload") && <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 mb-3">Your role can view ingested data but not upload. Analysts and Admins can upload.</div>}
          <div className="space-y-3">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger data-testid="ingest-domain-select" className="rounded-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{GROUPS.map((g) => Object.entries(DOMAINS).filter(([, v]) => v.group === g).map(([k, v]) => <SelectItem key={k} value={k}>{g.split(" ")[0]} · {v.label}</SelectItem>))}</SelectContent>
            </Select>
            <Select value={cp} onValueChange={setCp}>
              <SelectTrigger data-testid="ingest-counterparty-select" className="rounded-sm"><SelectValue placeholder="Counterparty (partner, supplier or customer)" /></SelectTrigger>
              <SelectContent>{cps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {info && <p className="text-xs text-slate-500">{info.desc}</p>}
            <div onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]); }} data-testid="csv-upload-dropzone"
              className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${drag ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50/60 hover:border-emerald-300"}`}>
              <div className="h-11 w-11 rounded-full bg-white border border-slate-200 grid place-items-center mx-auto"><UploadCloud className="h-5 w-5 text-emerald-600" /></div>
              <div className="text-sm font-semibold text-slate-800 mt-3">{file ? file.name : "Drop CSV / XLSX here or click to browse"}</div>
              <div className="text-[11px] text-slate-400 mt-1">Max 10 MB · re-uploaded rows are skipped automatically</div>
              <input ref={input} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files[0])} data-testid="csv-file-input" />
            </div>
            <div><span className="eyebrow">Required columns</span><div className="num mt-1 text-[11px] text-slate-500 break-words">{info?.columns.join(", ")}</div></div>
            <div className="flex gap-2">
              <button onClick={() => downloadFile(api, `/templates/${domain}`, `${domain.toLowerCase()}_template.csv`)} data-testid="download-template-button" className="btn-secondary"><Download className="h-4 w-4" />Template</button>
              <button onClick={upload} disabled={!file || !cp || busy || !can("upload")} data-testid="upload-submit-button" className="btn-primary flex-1">{busy ? "Ingesting & detecting…" : "Ingest & detect"}</button>
            </div>
          </div>
        </Panel>
        <Panel className="lg:col-span-7" eyebrow="History" title="Ingested batches" testId="batches-panel">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead><tr>{["File", "Scenario", "Rows", "Leaks", "By", "When"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {(batches.data || []).map((b) => (
                  <tr key={b.id} className="tr" data-testid={`batch-row-${b.id}`}>
                    <td className="px-4 py-2.5 text-slate-800 font-medium"><FileSpreadsheet className="h-3.5 w-3.5 inline mr-1.5 text-emerald-600" />{b.filename}<div className="text-[11px] text-slate-400 font-normal">{b.counterparty_name}</div></td>
                    <td className="px-4 py-2.5"><DomainBadge domain={b.domain} /></td>
                    <td className="px-4 py-2.5 num text-slate-700">{b.inserted}{b.skipped ? <span className="text-slate-400"> (+{b.skipped} dup)</span> : ""}</td>
                    <td className="px-4 py-2.5 num font-semibold text-rose-600 whitespace-nowrap">{b.detection ? `${b.detection.leaks} · ${money(b.detection.amount)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{b.uploaded_by}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 num whitespace-nowrap">{fmtDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="lg:col-span-12" eyebrow="Latest records" title="Transactions" testId="transactions-panel"
          action={<div className="flex flex-wrap gap-2 text-[11px] num font-semibold">{Object.entries(txns.data?.counts || {}).map(([k, v]) => <span key={k} className={`px-2 py-0.5 rounded-full ${RESULT[k] || "text-slate-500 bg-slate-100"}`}>{k}: {v}</span>)}</div>}>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead><tr>{["Reference", "Counterparty", "Scenario", "Date", "Result"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {(txns.data?.items || []).map((t) => (
                  <tr key={t.id} className="tr">
                    <td className="px-4 py-2 num text-xs text-slate-800">{t.ref}{t.duplicate_of && <span className="ml-2 text-rose-600 font-semibold">duplicate</span>}</td>
                    <td className="px-4 py-2 text-slate-700">{t.counterparty_name}</td>
                    <td className="px-4 py-2"><DomainBadge domain={t.domain} /></td>
                    <td className="px-4 py-2 num text-xs text-slate-500">{t.date}</td>
                    <td className="px-4 py-2"><span className={`num text-[11px] font-semibold px-2 py-0.5 rounded-full ${RESULT[t.result] || "text-slate-500 bg-slate-100"}`}>{t.result || "PENDING"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
