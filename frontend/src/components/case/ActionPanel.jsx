import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpCircle, CheckCircle2, Eye, UserPlus, XCircle, BadgeDollarSign, Ban, RotateCcw, ThumbsDown, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, useData, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { money } from "@/lib/format";
import { Panel } from "@/components/common";

const ESC = ["approver", "admin", "viewer_cfo"];
const ACTS = [
  { a: "start_review", label: "Start review", icon: Eye, cap: "work_case", from: ["OPEN"] },
  { a: "escalate", label: "Escalate to senior", icon: ArrowUpCircle, cap: "assign", from: ["OPEN", "IN_REVIEW", "DENIED"], dialog: "people", tone: "amber" },
  { a: "approve", label: "Approve claim", icon: CheckCircle2, cap: "approve", from: ["IN_REVIEW", "ESCALATED"], tone: "emerald" },
  { a: "assign", label: "Reassign", icon: UserPlus, cap: "assign", from: ["OPEN", "IN_REVIEW", "ESCALATED", "APPROVED", "CLAIM_SENT", "PARTIALLY_RECOVERED", "DENIED"], dialog: "people" },
  { a: "record_recovery", label: "Record recovery", icon: BadgeDollarSign, cap: "record_recovery", from: ["CLAIM_SENT", "PARTIALLY_RECOVERED"], dialog: "amount", tone: "emerald" },
  { a: "mark_denied", label: "Counterparty denied", icon: ThumbsDown, cap: "record_recovery", from: ["CLAIM_SENT"], dialog: "note" },
  { a: "dismiss", label: "Dismiss (not a leak)", icon: XCircle, cap: "approve", from: ["OPEN", "IN_REVIEW", "ESCALATED"], dialog: "note" },
  { a: "write_off", label: "Write off", icon: Ban, cap: "write_off", from: ["IN_REVIEW", "ESCALATED", "APPROVED", "CLAIM_SENT", "PARTIALLY_RECOVERED", "DENIED"], dialog: "note" },
  { a: "reopen", label: "Reopen", icon: RotateCcw, cap: "work_case", from: ["DISMISSED", "DENIED", "WRITTEN_OFF"] },
];
const TONE = {
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20",
  emerald: "bg-emerald-500 text-[#0b0f19] border-emerald-500 font-semibold hover:bg-emerald-400",
  default: "border-border text-slate-200 hover:bg-slate-800 hover:text-white",
};

const ActDialog = ({ act, c, onClose, onDone }) => {
  const api = useApi();
  const { me } = useMe();
  const team = useData("/team").data || [];
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(String(Math.max(c.leak_amount - (c.recovered_amount || 0), 0).toFixed(2)));
  const [busy, setBusy] = useState(false);
  const people = team.filter((p) => p.user_id !== me.user_id && (act.a !== "escalate" || ESC.includes(p.role)));
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/cases/${c.id}/action`, { action: act.a, note, assignee_id: assignee || null, amount: act.dialog === "amount" ? parseFloat(amount) : null });
      toast.success(act.a === "escalate" ? "Escalated — they've been notified" : `${act.label} done`);
      onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card" data-testid={`action-dialog-${act.a}`}>
        <DialogHeader>
          <DialogTitle>{act.label} · {c.number}</DialogTitle>
          <DialogDescription>{act.a === "escalate" ? "Hand this to an Approver, CFO or Admin who has authority to approve and send the claim. They get an in-app and email notification." : `Leakage ${money(c.leak_amount)} with ${c.counterparty_name}.`}</DialogDescription>
        </DialogHeader>
        {act.dialog === "people" && (
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger data-testid="assignee-select"><SelectValue placeholder="Choose a team member" /></SelectTrigger>
            <SelectContent>
              {!people.length && <div className="p-3 text-xs text-slate-400">No eligible team members yet — an Admin can grant roles in Team & Settings.</div>}
              {people.map((p) => <SelectItem key={p.user_id} value={p.user_id} data-testid={`assignee-option-${p.user_id}`}>{p.name} · {p.role_label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {act.dialog === "amount" && <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-background border border-input rounded-sm px-3 py-2 num" data-testid="recovery-amount-input" />}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={act.a === "dismiss" ? "Why is this not a leak? (required)" : "Add a note (optional)"} className="w-full bg-background border border-input rounded-sm px-3 py-2 text-sm" data-testid="action-note-input" />
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-sm border border-border hover:bg-slate-800">Cancel</button>
          <button onClick={submit} disabled={busy || (act.dialog === "people" && !assignee)} data-testid="action-confirm-button" className="px-4 py-2 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400 disabled:opacity-50">{busy ? "Working…" : "Confirm"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function ActionPanel({ c, onChange }) {
  const api = useApi();
  const { can, me } = useMe();
  const [open, setOpen] = useState(null);
  const avail = ACTS.filter((x) => x.from.includes(c.status));
  const run = async (act) => {
    if (act.dialog) return setOpen(act);
    try { await api.post(`/cases/${c.id}/action`, { action: act.a }); toast.success(`${act.label} done`); onChange(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel eyebrow="Workflow" title="Actions" testId="case-actions">
      <div className="text-xs text-slate-400 mb-3">Owner: <span className="text-white" data-testid="case-assignee">{c.assignee_name || "Unassigned"}</span></div>
      <div className="space-y-2">
        {avail.map((act) => {
          const ok = can(act.cap);
          return (
            <button key={act.a} disabled={!ok} onClick={() => run(act)} data-testid={`action-${act.a}-button`}
              title={ok ? "" : `Your role (${me.role_label}) can't do this — escalate instead`}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm border transition-colors ${ok ? TONE[act.tone || "default"] : "border-border text-slate-600 cursor-not-allowed"}`}>
              {ok ? <act.icon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{act.label}
            </button>
          );
        })}
        {!avail.length && <div className="text-sm text-slate-500">This case is closed.</div>}
      </div>
      {!can("approve") && ["OPEN", "IN_REVIEW"].includes(c.status) && <p className="text-[11px] text-slate-500 mt-3">You can't approve claims with your role. Escalate to a senior approver to move this forward.</p>}
      {open && <ActDialog act={open} c={c} onClose={() => setOpen(null)} onDone={() => { setOpen(null); onChange(); }} />}
    </Panel>
  );
}
