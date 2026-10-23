import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { LayoutDashboard, AlertTriangle, KanbanSquare, Upload, FileText, ShieldCheck, Sparkles, ScrollText, Users, Menu, Bell, Library } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMe } from "@/context/MeContext";
import { useApi, useData } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const NAV = [
  { to: "/app", label: "Control Tower", icon: LayoutDashboard, end: true, id: "control" },
  { to: "/app/scenarios", label: "Scenario Library", icon: Library, id: "scenarios" },
  { to: "/app/leakages", label: "Leakages", icon: AlertTriangle, id: "leakages" },
  { to: "/app/pipeline", label: "Recovery Pipeline", icon: KanbanSquare, id: "recovery" },
  { to: "/app/ingest", label: "Data Ingestion", icon: Upload, id: "data" },
  { to: "/app/contracts", label: "Contracts · Truth Layer", icon: FileText, id: "contracts" },
  { to: "/app/assurance", label: "Assurance", icon: ShieldCheck, id: "assurance" },
  { to: "/app/copilot", label: "Recovery Copilot", icon: Sparkles, cap: "use_ai", id: "copilot" },
  { to: "/app/audit", label: "Audit Log", icon: ScrollText, id: "audit" },
  { to: "/app/admin", label: "Team & Settings", icon: Users, cap: "manage_users", id: "team" },
];

const Brand = () => (
  <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
    <div className="h-7 w-7 rounded-sm bg-emerald-600 grid place-items-center text-white font-black text-xs font-mono">LR</div>
    <div>
      <div className="font-semibold text-slate-900 text-sm leading-none" style={{ fontFamily: "Outfit" }}>L&amp;R Accelerator</div>
      <div className="eyebrow mt-1 text-[9px]">Leakage · Recovery</div>
    </div>
  </div>
);

const NavList = ({ onNavigate }) => {
  const { can } = useMe();
  return (
    <nav className="p-3 space-y-0.5">
      {NAV.filter((n) => !n.cap || can(n.cap)).map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} data-testid={`nav-${n.id}`}
          className={({ isActive }) => `flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150 border-l-2 ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-600 font-medium" : "text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900"}`}>
          <n.icon className="h-4 w-4" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
};

const Bellbox = () => {
  const api = useApi();
  const nav = useNavigate();
  const { data, reload } = useData("/notifications");
  const [isOpen, setIsOpen] = useState(false);
  const open = async (o) => {
    setIsOpen(o);
    if (o) reload();
    if (!o && data?.unread) {
      await api.post("/notifications/read-all");
      reload();
    }
  };
  return (
    <Popover open={isOpen} onOpenChange={open}>
      <PopoverTrigger asChild>
        <button data-testid="notifications-bell" className="relative h-9 w-9 grid place-items-center rounded-sm border border-border bg-white hover:bg-slate-100 text-slate-600">
          <Bell className="h-4 w-4" />
          {data?.unread > 0 && <span data-testid="notifications-unread" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[10px] text-white grid place-items-center num">{data.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white">
        <div className="px-4 py-3 border-b border-border eyebrow">Notifications</div>
        <div className="max-h-80 overflow-auto">
          {!data?.items?.length && <div className="p-4 text-sm text-slate-500">You're all caught up.</div>}
          {data?.items?.map((n) => (
            <button key={n.id} onClick={() => { open(false); nav(n.link); }} data-testid={`notification-${n.id}`} className="w-full text-left px-4 py-3 border-b border-border hover:bg-slate-50">
              <div className="text-sm text-slate-900 flex items-center gap-2">{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}{n.title}</div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>
              <div className="text-[10px] text-slate-500 mt-1 num">{fmtDateTime(n.ts)}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function AppShell() {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-[#fbfbfc] sticky top-0 h-screen">
        <Brand />
        <NavList />
        <div className="mt-auto p-4 text-[11px] text-slate-500 border-t border-border">Every action is audit-logged.</div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 bg-white/85 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden h-9 w-9 grid place-items-center border border-border rounded-sm" data-testid="mobile-nav-toggle"><Menu className="h-4 w-4" /></button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-[#fbfbfc]">
                <Brand />
                <NavList onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="eyebrow hidden sm:inline">Workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <span data-testid="role-badge" className="text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded-sm border border-emerald-200 text-emerald-700 bg-emerald-50">{me.role_label}</span>
            <span className="hidden md:block text-sm text-slate-700">{me.name}</span>
            <Bellbox />
            <UserButton />
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
