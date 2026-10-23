import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Send, Save, Mail } from "lucide-react";
import { useApi, streamSSE, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { fmtDateTime } from "@/lib/format";
import { Panel } from "@/components/common";

export default function EmailDraft({ c, onChange }) {
  const api = useApi();
  const { can } = useMe();
  const [subject, setSubject] = useState(c.draft?.subject || "");
  const [body, setBody] = useState(c.draft?.body || "");
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSubject(c.draft?.subject || "");
    setBody(c.draft?.body || "");
  }, [c.draft]);
  const editable = can("work_case");
  const closed = ["RECOVERED", "DISMISSED", "WRITTEN_OFF"].includes(c.status);
  const generate = async () => {
    setStreaming(true);
    setBody("");
    try {
      await streamSSE(api, `/ai/cases/${c.id}/draft`, {}, (ev) => {
        if (ev.delta) setBody((b) => b + ev.delta);
        if (ev.error) toast.error(ev.error);
        if (ev.done) { setSubject(ev.subject); toast.success("Draft ready — review before sending"); }
      });
    } catch (e) { toast.error(e.message); } finally { setStreaming(false); }
  };
  const save = async () => {
    setBusy(true);
    try { await api.put(`/cases/${c.id}/draft`, { subject, body }); toast.success("Draft saved"); onChange(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const send = async (kind) => {
    setBusy(true);
    try {
      if (editable && (subject !== c.draft?.subject || body !== c.draft?.body)) await api.put(`/cases/${c.id}/draft`, { subject, body });
      await api.post(`/cases/${c.id}/send`, { kind });
      toast.success(kind === "claim" ? `Claim emailed to ${c.counterparty?.contact_email}` : "Follow-up sent");
      onChange();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const canSendClaim = can("send_claim") && c.status === "APPROVED";
  const canFollow = can("send_claim") && ["CLAIM_SENT", "PARTIALLY_RECOVERED"].includes(c.status);
  return (
    <Panel eyebrow="Recovery email · Claude" title="Claim draft" testId="case-email" action={<Sparkles className="h-4 w-4 text-indigo-500" />}>
      <div className="text-xs text-slate-500 mb-3">To: <span className="text-slate-900 font-semibold num" data-testid="email-recipient">{c.counterparty?.contact_email || "No contact set"}</span>{c.counterparty?.contact_name && <span> · {c.counterparty.contact_name}</span>}</div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} placeholder="Subject" className="field mb-2" data-testid="email-subject-input" />
      <div className="relative">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable || streaming} rows={11} placeholder={editable ? "Generate an AI draft grounded in this case's evidence, or write your own." : "No draft yet."}
          className="field leading-relaxed" data-testid="email-body-input" />
        {streaming && <span className="caret absolute bottom-3 right-3 text-xs text-indigo-600">writing</span>}
      </div>
      {c.draft?.by && <div className="text-[11px] text-slate-500 mt-1">Last edit: {c.draft.by} · {fmtDateTime(c.draft.updated_at)}</div>}
      <div className="flex flex-wrap gap-2 mt-3">
        {editable && !closed && <button onClick={generate} disabled={streaming} data-testid="ai-email-generate-button" className="btn-ai px-3"><Sparkles className="h-4 w-4" />{streaming ? "Drafting…" : body ? "Regenerate" : "Draft with AI"}</button>}
        {editable && <button onClick={save} disabled={busy || streaming || !body} data-testid="email-save-button" className="btn-secondary px-3"><Save className="h-4 w-4" />Save</button>}
        {canSendClaim && <button onClick={() => send("claim")} disabled={busy || streaming || !body} data-testid="email-send-claim-button" className="btn-primary px-3"><Send className="h-4 w-4" />Approve & send claim</button>}
        {canFollow && <button onClick={() => send("follow_up")} disabled={busy || !body} data-testid="email-send-followup-button" className="btn-warn px-3"><Send className="h-4 w-4" />Send follow-up</button>}
      </div>
      {!can("send_claim") && c.status === "APPROVED" && <p className="text-[11px] text-slate-500 mt-2">Only Approvers and Admins can send claims to counterparties.</p>}
      {c.emails?.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3 space-y-2" data-testid="email-log">
          <div className="eyebrow">Sent</div>
          {c.emails.map((e) => <div key={e.id} className="text-xs text-slate-500 flex gap-2"><Mail className="h-3.5 w-3.5 mt-0.5 text-slate-400" /><span><span className="font-semibold text-slate-800">{e.kind === "claim" ? "Claim" : "Follow-up"}</span> → {e.to} · {e.by} · {fmtDateTime(e.ts)}</span></div>)}
        </div>
      )}
    </Panel>
  );
}
