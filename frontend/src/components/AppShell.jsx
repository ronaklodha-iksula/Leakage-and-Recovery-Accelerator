import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { LayoutDashboard, AlertTriangle, KanbanSquare, Upload, FileText, ShieldCheck, Sparkles, ScrollText, Users, Menu, Bell, Library } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMe } from "@/context/MeContext";
import { useApi, useData } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const SECTIONS = [
  { title: "Overview", items: [
    { to: "/app", label: "Control Tower", icon: LayoutDashboard, end: true, id: "control" },
    { to: "/app/scenarios", label: "Scenario Library", icon: Library, id: "scenarios" },
  ] },
  { title: "Detect & recover", items: [
    { to: "/app/leakages", label: "Leakages", icon: AlertTriangle, id: "leakages" },
    { to: "/app/pipeline", label: "Recovery Pipeline", icon: KanbanSquare, id: "recovery" },
    { to: "/app/assurance", label: "Assurance", icon: ShieldCheck, id: "assurance" },
    { to: "/app/copilot", label: "Recovery Copilot", icon: Sparkles, cap: "use_ai", id: "copilot" },
  ] },
  { title: "Data & rules", items: [
    { to: "/app/ingest", label: "Data Ingestion", icon: Upload, id: "data" },
    { to: "/app/contracts", label: "Contracts & Terms", icon: FileText, id: "contracts" },
  ] },
  { title: "Governance", items: [
    { to: "/app/audit", label: "Audit Log", icon: ScrollText, id: "audit" },
    { to: "/app/admin", label: "Team & Settings", icon: Users, cap: "manage_users", id: "team" },
  ] },
];

const Brand = () => (
  <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200/80">
    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white font-extrabold text-xs font-mono shadow-sm">LR</div>
    <div>
      <div className="font-bold text-slate-900 text-sm leading-none" style={{ fontFamily: "Outfit" }}>L&amp;R Accelerator</div>
      <div className="text-[10px] text-slate-400 mt-1 font-medium">Leakage · Recovery</div>
    </div>
  </div>
);

const NavList = ({ onNavigate }) => {
  const { can } = useMe();
  return (
    <nav className="p-3 space-y-5 overflow-y-auto">
      {SECTIONS.map((s) => (
        <div key={s.title}>
          <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{s.title}</div>
          {s.items.filter((n) => !n.cap || can(n.cap)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} data-testid={`nav-${n.id}`}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${isActive ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </div>
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
        <button data-testid="notifications-bell" className="relative h-9 w-9 grid place-items-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
          <Bell className="h-4 w-4" />
          {data?.unread > 0 && <span data-testid="notifications-unread" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[10px] text-white grid place-items-center num">{data.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-white shadow-lg">
        <div className="px-4 py-3 border-b border-slate-100 eyebrow">Notifications</div>
        <div className="max-h-80 overflow-auto">
          {!data?.items?.length && <div className="p-4 text-sm text-slate-500">You're all caught up.</div>}
          {data?.items?.map((n) => (
            <button key={n.id} onClick={() => { open(false); nav(n.link); }} data-testid={`notification-${n.id}`} className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}{n.title}</div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>
              <div className="text-[10px] text-slate-400 mt-1 num">{fmtDateTime(n.ts)}</div>
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
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200/80 bg-white sticky top-0 h-screen">
        <Brand />
        <NavList />
        <div className="mt-auto m-3 rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600 mb-1" />Role-based access · every action audit-logged
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden h-9 w-9 grid place-items-center border border-slate-200 rounded-lg" data-testid="mobile-nav-toggle"><Menu className="h-4 w-4" /></button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-white">
                <Brand />
                <NavList onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="hidden sm:inline text-sm text-slate-500">Finance workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <span data-testid="role-badge" className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50">{me.role_label}</span>
            <span className="hidden md:block text-sm font-medium text-slate-700">{me.name}</span>
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
