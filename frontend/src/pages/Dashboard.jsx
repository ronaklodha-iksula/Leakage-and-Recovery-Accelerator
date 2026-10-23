import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Clock, ShieldAlert, ArrowUpRight, TrendingDown, Wallet, Send, CircleDollarSign, Gauge } from "lucide-react";
import { useData } from "@/lib/api";
import { DOMAINS, money, daysUntil } from "@/lib/format";
import { PageHeader, Panel, StatusChip, Money, Empty } from "@/components/common";
import { useMe } from "@/context/MeContext";

const KPI = ({ label, value, sub, tone, testId, i, children }) => (
  <div data-testid={testId} className={`panel p-5 rise rise-${i}`}>
    <div className="eyebrow">{label}</div>
    <div className={`num text-2xl xl:text-3xl mt-3 ${tone}`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-2">{sub}</div>}
    {children}
  </div>
);

const tip = { contentStyle: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,.08)" }, formatter: (v) => money(v) };

const CaseRow = ({ c, right }) => (
  <Link to={`/app/leakages/${c.id}`} data-testid={`dash-case-${c.number}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0 hover:bg-slate-50 px-2 -mx-2 rounded-sm">
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2 min-w-0"><span className="num text-xs text-emerald-700 shrink-0 whitespace-nowrap">{c.number}</span><span className="truncate min-w-0">{c.counterparty_name}</span></div>
      <div className="text-xs text-slate-400 truncate num">{c.ref}</div>
    </div>
    <div className="text-right shrink-0">{right}</div>
  </Link>
);

export default function Dashboard() {
  const { me } = useMe();
  const { data, error } = useData("/dashboard");
  if (error) return <Empty title="Could not load dashboard" desc={error} />;
  if (!data) return <div className="eyebrow">Loading control tower…</div>;
  const k = data.kpis;
  const domains = data.by_domain.map((d) => ({ ...d, name: DOMAINS[d.domain]?.short, color: DOMAINS[d.domain]?.color })).sort((a, b) => b.identified - a.identified);
  return (
    <div>
      <PageHeader eyebrow={`Control Tower · ${data.settings.company_name}`} title={`Welcome back, ${me.name?.split(" ")[0] || "there"}`}
        desc="Leakage identified across partners, suppliers and customers — what's recoverable, what's in claim and what's back in the bank.">
        <Link to="/app/scenarios" data-testid="dash-view-scenarios" className="btn-secondary">Scenario library</Link>
        <Link to="/app/leakages" data-testid="dash-view-leakages" className="btn-primary">All leakages <ArrowUpRight className="h-4 w-4" /></Link>
      </PageHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPI i={1} testId="kpi-identified" icon={TrendingDown} tone="text-rose-600" label="Leakage identified" value={money(k.identified)} sub={`${k.cases} cases`} />
        <KPI i={2} testId="kpi-recoverable" icon={Wallet} tone="text-slate-900" label="Recoverable (open)" value={money(k.recoverable)} sub={`${k.open_cases} open cases`} />
        <KPI i={3} testId="kpi-in-claim" icon={Send} tone="text-amber-600" label="In claim" value={money(k.in_claim)} sub="Awaiting counterparty" />
        <KPI i={4} testId="kpi-recovered" icon={CircleDollarSign} tone="text-emerald-600" label="Recovered" value={money(k.recovered)} sub={`Written off ${money(k.written_off)}`} />
        <KPI i={4} testId="kpi-recovery-rate" icon={Gauge} tone="text-slate-900" label="Recovery rate" value={`${k.recovery_rate}%`}>
          <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden"><div className="h-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${Math.min(k.recovery_rate, 100)}%` }} /></div>
        </KPI>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6">
        <Panel className="md:col-span-8" eyebrow="Monthly" title="Identified vs recovered" testId="chart-trend"
          action={<div className="flex gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Identified</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" />Recovered</span></div>}>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.25} /><stop offset="100%" stopColor="#059669" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => money(v, "USD", true)} width={60} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="identified" stroke="#f59e0b" fill="url(#gi)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="recovered" stroke="#059669" fill="url(#gr)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="md:col-span-4" eyebrow="By scenario" title="Where it leaks" testId="chart-domain">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={domains} layout="vertical" margin={{ left: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={84} />
                <Tooltip {...tip} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="identified" radius={[0, 4, 4, 0]} barSize={14}>{domains.map((d) => <Cell key={d.domain} fill={d.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="md:col-span-5" eyebrow="Counterparties" title="Exposure by partner, supplier & customer" testId="panel-counterparties">
          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
            {data.by_counterparty.map((p) => {
              const pct = p.identified ? (p.recovered / p.identified) * 100 : 0;
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-slate-800">{p.name}</span><span className="num font-semibold text-slate-900">{money(p.identified)}</span></div>
                  <div className="h-1.5 bg-amber-100 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>{p.count} cases · open {money(p.open)}</span><span className="num">{pct.toFixed(0)}% recovered</span></div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel className="md:col-span-4" eyebrow="Deadline risk" title="Dispute windows closing" testId="panel-expiring" action={<Clock className="h-4 w-4 text-amber-500" />}>
          {!data.expiring.length && <div className="text-sm text-slate-500">No open case expires in the next {data.settings.expiring_window_days} days.</div>}
          {data.expiring.map((c) => {
            const d = daysUntil(c.window_ends_at);
            return <CaseRow key={c.id} c={c} right={<><Money value={c.leak_amount} className="text-sm text-slate-900" /><div className={`text-[11px] num font-semibold ${d < 0 ? "text-rose-600" : "text-amber-600"}`}>{d < 0 ? `expired ${-d}d ago` : `${d}d left`}</div></>} />;
          })}
        </Panel>
        <Panel className="md:col-span-3" eyebrow="Assigned to you" title="My queue" testId="panel-my-queue">
          {data.assurance_pending > 0 && (
            <Link to="/app/assurance" className="flex items-center gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-sm px-3 py-2 mb-3" data-testid="dash-assurance-pending">
              <ShieldAlert className="h-4 w-4" /> {data.assurance_pending} high-value cases need Assurance
            </Link>
          )}
          {!data.my_queue.length && <div className="text-sm text-slate-500">Nothing assigned to you right now.</div>}
          {data.my_queue.map((c) => <CaseRow key={c.id} c={c} right={<StatusChip status={c.status} />} />)}
        </Panel>
        <Panel className="md:col-span-12" eyebrow="Workflow" title="Case status" testId="panel-status">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {Object.entries(data.status_counts).map(([s, n]) => (
              <Link key={s} to={`/app/leakages?status=${s}`} className="min-w-0 border border-border rounded-sm p-3 hover:bg-slate-50 transition-colors" data-testid={`status-count-${s}`}>
                <StatusChip status={s} /><div className="num text-xl font-bold text-slate-900 mt-2">{n}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
