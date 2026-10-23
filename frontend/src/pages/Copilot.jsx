import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Send, Trash2 } from "lucide-react";
import { useApi, streamSSE, errMsg } from "@/lib/api";
import { PageHeader } from "@/components/common";

const PROMPTS = [
  "What is our biggest Amazon fee overcharge and what should we do about it?",
  "Which customers owe us money from short or overdue payments?",
  "Which dispute windows close in the next two weeks?",
  "Summarise recovery performance by scenario for the CFO.",
];

export default function Copilot() {
  const api = useApi();
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef();
  useEffect(() => {
    api.get("/ai/copilot/history").then((r) => setMsgs(r.data)).catch(() => {});
  }, [api]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  const ask = async (question) => {
    if (!question.trim() || busy) return;
    setQ("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "", streaming: true }]);
    try {
      await streamSSE(api, "/ai/copilot", { question }, (ev) => {
        if (ev.delta) setMsgs((m) => { const n = [...m]; n[n.length - 1] = { ...n[n.length - 1], text: n[n.length - 1].text + ev.delta }; return n; });
        if (ev.error) toast.error(ev.error);
      });
    } catch (e) { toast.error(e.message); } finally {
      setMsgs((m) => { const n = [...m]; n[n.length - 1] = { ...n[n.length - 1], streaming: false }; return n; });
      setBusy(false);
    }
  };
  const clear = async () => { try { await api.delete("/ai/copilot/history"); setMsgs([]); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader eyebrow="Claude · grounded in your data" title="Recovery Copilot" desc="Ask about leakages, deadlines and recovery performance. Answers only use what's in this workspace.">
        {msgs.length > 0 && <button onClick={clear} data-testid="copilot-clear-button" className="btn-secondary"><Trash2 className="h-4 w-4" />Clear</button>}
      </PageHeader>
      <div className="flex-1 overflow-y-auto panel p-5 space-y-5" data-testid="copilot-messages">
        {!msgs.length && (
          <div className="grid sm:grid-cols-2 gap-3">
            {PROMPTS.map((p, i) => <button key={p} onClick={() => ask(p)} data-testid={`copilot-prompt-${i}`} className="text-left text-sm p-4 rounded-md border border-slate-200 bg-slate-50/60 hover:border-indigo-200 hover:bg-indigo-50/60 text-slate-700 transition-colors"><Sparkles className="h-4 w-4 text-indigo-500 mb-2" />{p}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-3"} data-testid={`copilot-msg-${i}`}>
            {m.role !== "user" && <div className="h-7 w-7 shrink-0 rounded-sm bg-indigo-50 text-indigo-600 grid place-items-center"><Sparkles className="h-3.5 w-3.5" /></div>}
            <div className={`max-w-3xl text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-emerald-600 text-white rounded-md px-4 py-2.5" : "text-slate-700"}`}>
              {m.text}{m.streaming && <span className="caret" />}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Draft talking points for disputing the Walmart OTIF deductions" className="field py-3" data-testid="copilot-input" />
        <button disabled={busy || !q.trim()} data-testid="copilot-send-button" className="btn-primary px-4"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
