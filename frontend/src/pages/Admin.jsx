import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useApi, useData, errMsg } from "@/lib/api";
import { useMe } from "@/context/MeContext";
import { PageHeader, Panel } from "@/components/common";

const inp = "w-full bg-background border border-input rounded-sm px-3 py-2 text-sm";
const PERMS = [
  ["Analyst", "Upload data, run detection, investigate, draft claims, comment, escalate/assign"],
  ["Approver", "Approve or dismiss, send claims & follow-ups, record recoveries, write off"],
  ["Assurance", "Independent confirm/disagree; required for claims above the dual-control threshold"],
  ["Rule Author", "Create, version and publish contract rules (truth layer)"],
  ["Viewer / CFO", "Read everything, dashboards, Copilot, comment; receives escalations and can approve or dismiss claims"],
  ["Admin", "Everything above + team roles, counterparties and settings"],
];

const Team = () => {
  const api = useApi();
  const { me, reload: reloadMe } = useMe();
  const { data, reload } = useData("/users");
  const change = async (uid, role) => {
    try { await api.patch(`/users/${uid}/role`, { role }); toast.success("Role updated"); reload(); if (uid === me.user_id) reloadMe(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <Panel className="lg:col-span-8" eyebrow="People" title="Team members" testId="team-panel">
        <p className="text-xs text-slate-500 mb-4">New sign-ups land as <span className="text-amber-300">Pending approval</span> and see no data until you grant a role. Invite people from Manage → Users &amp; Auth or ask them to sign up.</p>
        <div className="divide-y divide-border">
          {(data?.users || []).map((u) => (
            <div key={u.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3" data-testid={`team-row-${u.email}`}>
              <div><div className="text-sm text-white">{u.name}{u.user_id === me.user_id && <span className="text-xs text-slate-500"> (you)</span>}</div><div className="text-xs text-slate-500 num">{u.email}</div></div>
              <Select value={u.role} onValueChange={(r) => change(u.user_id, r)}>
                <SelectTrigger className="w-48" data-testid={`role-select-${u.email}`}><SelectValue /></SelectTrigger>
                <SelectContent>{(data?.roles || []).map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="lg:col-span-4" eyebrow="Access matrix" title="What each role can do">
        <div className="space-y-3">{PERMS.map(([r, d]) => <div key={r}><div className="text-sm text-emerald-300">{r}</div><div className="text-xs text-slate-400">{d}</div></div>)}</div>
      </Panel>
    </div>
  );
};

const CPDialog = ({ cp, onClose, onSaved }) => {
  const api = useApi();
  const [f, setF] = useState(cp || { name: "", type: "MARKETPLACE", contact_name: "", contact_email: "", currency: "USD", portal_url: "", notes: "" });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const save = async () => {
    try { cp ? await api.put(`/counterparties/${cp.id}`, f) : await api.post("/counterparties", f); toast.success("Saved"); onSaved(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card" data-testid="counterparty-dialog">
        <DialogHeader><DialogTitle>{cp ? `Edit ${cp.name}` : "New counterparty"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <input className={inp} placeholder="Name" value={f.name} onChange={set("name")} data-testid="cp-name-input" />
          <Select value={f.type} onValueChange={set("type")}>
            <SelectTrigger data-testid="cp-type-select"><SelectValue /></SelectTrigger>
            <SelectContent>{["MARKETPLACE", "RETAILER", "SUPPLIER", "CARRIER"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <input className={inp} placeholder="Dispute contact name" value={f.contact_name} onChange={set("contact_name")} data-testid="cp-contact-name-input" />
          <input className={inp} placeholder="Dispute contact email (claims are sent here)" value={f.contact_email} onChange={set("contact_email")} data-testid="cp-contact-email-input" />
          <div className="grid grid-cols-2 gap-3">
            <input className={inp} placeholder="Currency" value={f.currency} onChange={set("currency")} data-testid="cp-currency-input" />
            <input className={inp} placeholder="Portal URL" value={f.portal_url} onChange={set("portal_url")} data-testid="cp-portal-input" />
          </div>
        </div>
        <DialogFooter><button onClick={save} disabled={!f.name} data-testid="cp-save-button" className="px-4 py-2 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400 disabled:opacity-50">Save</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Counterparties = () => {
  const { data, reload } = useData("/counterparties");
  const [edit, setEdit] = useState(null);
  const api = useApi();
  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try { await api.delete(`/counterparties/${c.id}`); toast.success("Deleted"); reload(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel eyebrow="Partners" title="Counterparties & dispute contacts" testId="counterparties-panel"
      action={<button onClick={() => setEdit({})} data-testid="new-counterparty-button" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400"><Plus className="h-4 w-4" />Add</button>}>
      <div className="divide-y divide-border">
        {(data || []).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 py-3" data-testid={`cp-row-${c.id}`}>
            <div className="min-w-0"><div className="text-sm text-white">{c.name} <span className="text-[10px] font-mono text-slate-500 ml-1">{c.type}</span></div><div className="text-xs text-slate-400 num truncate">{c.contact_name} · {c.contact_email || "no email"}</div></div>
            <div className="flex gap-2">
              <button onClick={() => setEdit(c)} data-testid={`cp-edit-${c.id}`} className="p-2 rounded-sm border border-border hover:bg-slate-800 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(c)} data-testid={`cp-delete-${c.id}`} className="p-2 rounded-sm border border-border text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      {edit && <CPDialog cp={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </Panel>
  );
};

const Settings = () => {
  const api = useApi();
  const { data } = useData("/settings");
  const [f, setF] = useState(null);
  useEffect(() => {
    if (data) setF(data);
  }, [data]);
  if (!f) return null;
  const save = async () => {
    try { await api.put("/settings", { dual_approval_threshold: parseFloat(f.dual_approval_threshold), expiring_window_days: parseInt(f.expiring_window_days, 10), company_name: f.company_name, auto_detect_on_upload: f.auto_detect_on_upload }); toast.success("Settings saved"); } catch (e) { toast.error(errMsg(e)); }
  };
  const clear = async () => {
    if (!window.confirm("Remove all sample counterparties, rules, transactions and cases? Your own uploads stay.")) return;
    try { const r = (await api.delete("/admin/sample-data")).data; toast.success(`Removed ${r.cases} sample cases`); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Panel eyebrow="Controls" title="Workspace settings" testId="settings-panel">
        <div className="space-y-4">
          <label className="block text-xs text-slate-400">Company name (used in claim emails)<input className={inp} value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} data-testid="settings-company-input" /></label>
          <label className="block text-xs text-slate-400">Dual-control threshold (USD) — Assurance must confirm claims at or above this<input type="number" className={`${inp} num`} value={f.dual_approval_threshold} onChange={(e) => setF({ ...f, dual_approval_threshold: e.target.value })} data-testid="settings-threshold-input" /></label>
          <label className="block text-xs text-slate-400">Warn when a dispute window closes within (days)<input type="number" className={`${inp} num`} value={f.expiring_window_days} onChange={(e) => setF({ ...f, expiring_window_days: e.target.value })} data-testid="settings-window-input" /></label>
          <div className="flex items-center justify-between text-sm"><span className="text-slate-300">Run detection automatically on upload</span><Switch checked={f.auto_detect_on_upload} onCheckedChange={(v) => setF({ ...f, auto_detect_on_upload: v })} data-testid="settings-autodetect-switch" /></div>
          <button onClick={save} data-testid="settings-save-button" className="px-4 py-2 text-sm rounded-sm bg-emerald-500 text-[#0b0f19] font-semibold hover:bg-emerald-400">Save settings</button>
        </div>
      </Panel>
      <Panel eyebrow="Danger zone" title="Sample data">
        <p className="text-sm text-slate-400">The workspace ships with sample counterparties (Amazon, Walmart, Target, suppliers, a carrier), contract rules and ~50 planted leakages so you can try every flow. Remove them when you're ready to go live with your own data.</p>
        <button onClick={clear} data-testid="clear-sample-button" className="mt-4 px-4 py-2 text-sm rounded-sm border border-rose-500/40 text-rose-300 hover:bg-rose-500/10">Remove sample data</button>
      </Panel>
    </div>
  );
};

export default function Admin() {
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Team & settings" desc="Who can do what, where claims are sent, and the controls that govern approvals." />
      <Tabs defaultValue="team">
        <TabsList className="mb-6">
          <TabsTrigger value="team" data-testid="admin-tab-team">Team & roles</TabsTrigger>
          <TabsTrigger value="cps" data-testid="admin-tab-counterparties">Counterparties</TabsTrigger>
          <TabsTrigger value="settings" data-testid="admin-tab-settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="team"><Team /></TabsContent>
        <TabsContent value="cps"><Counterparties /></TabsContent>
        <TabsContent value="settings"><Settings /></TabsContent>
      </Tabs>
    </div>
  );
}
