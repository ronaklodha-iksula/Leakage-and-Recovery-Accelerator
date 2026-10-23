import { useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, Download, Play, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, useData, downloadFile, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { DOMAINS, fmtDateTime, money } from "@/lib/format";
import { PageHeader, Panel, DomainBadge } from "@/components/common";

const RESULT = { LEAK: "text-rose-300", MATCHED: "text-emerald-300", NO_RULE: "text-amber-300" };

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
  const cols = domains.find((d) => d.key === domain)?.columns || [];
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
      <PageHeader eyebrow="Ingest" title="Data ingestion" desc="Upload settlement reports, deduction notices, supplier invoices, rebate statements or carrier bills (CSV or Excel). Each row is checked against the counterparty's published contract.">
        {can("detect") && <button onClick={detect} data-testid="run-detection-button" className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-sm border border-border hover:bg-slate-800 hover:text-white"><Play className="h-4 w-4" />Run detection on pending</button>}
      </PageHeader>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Panel className="lg:col-span-5" eyebrow="Step 1–3" title="Upload a file" testId="upload-panel">
          {!can("upload") && <div className="text-sm text-amber-300 mb-3">Your role can view ingested data but not upload. Analysts and Admins can upload.</div>}
          <div className="space-y-3">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger data-testid="ingest-domain-select"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DOMAINS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={cp} onValueChange={setCp}>
              <SelectTrigger data-testid="ingest-counterparty-select"><SelectValue placeholder="Counterparty" /></SelectTrigger>
              <SelectContent>{cps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]); }} data-testid="csv-upload-dropzone"
              className={`border border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${drag ? "border-emerald-400 bg-emerald-500/5" : "border-slate-700 hover:border-slate-500"}`}>
              <UploadCloud className="h-7 w-7 mx-auto text-slate-400" />
              <div className="text-sm text-slate-200 mt-2">{file ? file.name : "Drop CSV / XLSX here or click to browse"}</div>
              <div className="text-[11px] text-slate-500 mt-1">Max 10 MB · re-uploaded rows are skipped automatically</div>
              <input ref={input} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files[0])} data-testid="csv-file-input" />
            </div>
            <div className="text-[11px] text-slate-500"><span className="eyebrow">Required columns</span><div className="num mt-1 text-slate-400 break-words">{cols.join(", ")}</div></div>
            <div className="flex gap-2">
              <button onClick={() => downloadFile(api, `/templates/${domain}`, `${domain.toLowerCase()}_template.csv`)} data-testid="download-template-button" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-sm border border-border hover:bg-slate-800 hover:text-white"><Download className="h-4 w-4" />Template</button>
              <button onClick={upload} disabled={!file || !cp || busy || !can("upload")} data-testid="upload-submit-button" className="flex-1 px-3 py-2 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400 disabled:opacity-40">{busy ? "Ingesting & detecting…" : "Ingest & detect"}</button>
            </div>
          </div>
        </Panel>
        <Panel className="lg:col-span-7" eyebrow="History" title="Ingested batches" testId="batches-panel">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b border-border">{["File", "Domain", "Rows", "Leaks", "By", "When"].map((h) => <th key={h} className="eyebrow font-normal py-2 pr-3">{h}</th>)}</tr></thead>
              <tbody>
                {(batches.data || []).map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0" data-testid={`batch-row-${b.id}`}>
                    <td className="py-2.5 pr-3 text-slate-200"><FileSpreadsheet className="h-3.5 w-3.5 inline mr-1.5 text-slate-500" />{b.filename}<div className="text-[11px] text-slate-500">{b.counterparty_name}</div></td>
                    <td className="py-2.5 pr-3"><DomainBadge domain={b.domain} /></td>
                    <td className="py-2.5 pr-3 num text-slate-300">{b.inserted}{b.skipped ? <span className="text-slate-500"> (+{b.skipped} dup)</span> : ""}</td>
                    <td className="py-2.5 pr-3 num text-rose-300">{b.detection ? `${b.detection.leaks} · ${money(b.detection.amount)}` : "—"}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-400">{b.uploaded_by}</td>
                    <td className="py-2.5 text-xs text-slate-500 num">{fmtDateTime(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="lg:col-span-12" eyebrow="Latest records" title="Transactions" testId="transactions-panel"
          action={<div className="flex gap-3 text-xs num">{Object.entries(txns.data?.counts || {}).map(([k, v]) => <span key={k} className={RESULT[k] || "text-slate-400"}>{k}: {v}</span>)}</div>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b border-border">{["Reference", "Counterparty", "Domain", "Date", "Result"].map((h) => <th key={h} className="eyebrow font-normal py-2 pr-3">{h}</th>)}</tr></thead>
              <tbody>
                {(txns.data?.items || []).map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 num text-xs text-slate-200">{t.ref}{t.duplicate_of && <span className="ml-2 text-rose-400">duplicate</span>}</td>
                    <td className="py-2 pr-3 text-slate-300">{t.counterparty_name}</td>
                    <td className="py-2 pr-3"><DomainBadge domain={t.domain} /></td>
                    <td className="py-2 pr-3 num text-xs text-slate-400">{t.date}</td>
                    <td className={`py-2 num text-xs ${RESULT[t.result] || "text-slate-500"}`}>{t.result || "PENDING"}</td>
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
