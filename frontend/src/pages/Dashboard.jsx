import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Clock, ShieldAlert, ArrowUpRight } from "lucide-react";
import { useData } from "@/lib/api";
import { DOMAINS, money, daysUntil } from "@/lib/format";
import { PageHeader, Panel, StatusChip, DomainBadge, Money, Empty } from "@/components/common";
import { useMe } from "@/context/MeContext";

const KPI = ({ label, value, sub, tone, testId, i }) => (
  <div data-testid={testId} className={`panel p-5 rise rise-${i}`}>
    <div className="eyebrow">{label}</div>
    <div className={`num text-2xl xl:text-3xl mt-3 ${tone}`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-2">{sub}</div>}
  </div>
);

const tip = { contentStyle: { background: "#111827", border: "1px solid #1f2937", borderRadius: 4, fontSize: 12 }, formatter: (v) => money(v) };

const CaseRow = ({ c, right }) => (
  <Link to={`/app/leakages/${c.id}`} data-testid={`dash-case-${c.number}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0 hover:bg-slate-800/40 px-2 -mx-2 rounded-sm">
    <div className="min-w-0">
      <div className="text-sm text-white flex items-center gap-2"><span className="num text-slate-400">{c.number}</span>{c.counterparty_name}</div>
      <div className="text-xs text-slate-500 truncate">{c.ref}</div>
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
  const domains = data.by_domain.map((d) => ({ ...d, name: DOMAINS[d.domain]?.short, color: DOMAINS[d.domain]?.color }));
  return (
    <div>
      <PageHeader eyebrow={`Control Tower · ${data.settings.company_name}`} title={`Good to see you, ${me.name?.split(" ")[0] || "there"}`}
        desc="Leakage identified across every counterparty, what's recoverable, and what's already back in the bank.">
        <Link to="/app/leakages" data-testid="dash-view-leakages" className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded-sm border border-border hover:bg-slate-800 hover:text-white">All leakages <ArrowUpRight className="h-4 w-4" /></Link>
      </PageHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPI i={1} testId="kpi-identified" label="Leakage identified" value={money(k.identified)} sub={`${k.cases} cases`} tone="text-rose-300" />
        <KPI i={2} testId="kpi-recoverable" label="Recoverable (open)" value={money(k.recoverable)} sub={`${k.open_cases} open cases`} tone="text-white" />
        <KPI i={3} testId="kpi-in-claim" label="In claim" value={money(k.in_claim)} sub="Awaiting counterparty" tone="text-amber-300" />
        <KPI i={4} testId="kpi-recovered" label="Recovered" value={money(k.recovered)} sub={`Written off ${money(k.written_off)}`} tone="text-emerald-300" />
        <div data-testid="kpi-recovery-rate" className="panel p-5 rise rise-4">
          <div className="eyebrow">Recovery rate</div>
          <div className="num text-2xl xl:text-3xl mt-3 text-white">{k.recovery_rate}%</div>
          <div className="h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden"><div className="h-full bg-emerald-500 transition-[width] duration-700" style={{ width: `${Math.min(k.recovery_rate, 100)}%` }} /></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6">
        <Panel className="md:col-span-8" eyebrow="Monthly" title="Identified vs recovered" testId="chart-trend">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.trend}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => money(v, "USD", true)} width={60} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="identified" stroke="#f43f5e" fill="url(#gi)" strokeWidth={2} />
                <Area type="monotone" dataKey="recovered" stroke="#10b981" fill="url(#gr)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="md:col-span-4" eyebrow="By domain" title="Where it leaks" testId="chart-domain">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={domains} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={80} />
                <Tooltip {...tip} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                <Bar dataKey="identified" radius={[0, 3, 3, 0]}>{domains.map((d) => <Cell key={d.domain} fill={d.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="md:col-span-5" eyebrow="Counterparties" title="Exposure by partner" testId="panel-counterparties">
          <div className="space-y-3">
            {data.by_counterparty.map((p) => {
              const pct = p.identified ? (p.recovered / p.identified) * 100 : 0;
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-sm"><span className="text-slate-200">{p.name}</span><span className="num text-slate-300">{money(p.identified)}</span></div>
                  <div className="h-1.5 bg-rose-500/20 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1"><span>{p.count} cases · open {money(p.open)}</span><span className="num">{pct.toFixed(0)}% recovered</span></div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel className="md:col-span-4" eyebrow="Deadline risk" title="Dispute windows closing" testId="panel-expiring"
          action={<Clock className="h-4 w-4 text-amber-400" />}>
          {!data.expiring.length && <div className="text-sm text-slate-500">No open case expires in the next {data.settings.expiring_window_days} days.</div>}
          {data.expiring.map((c) => {
            const d = daysUntil(c.window_ends_at);
            return <CaseRow key={c.id} c={c} right={<><Money value={c.leak_amount} className="text-sm text-white" /><div className={`text-[11px] num ${d < 0 ? "text-rose-400" : "text-amber-300"}`}>{d < 0 ? `expired ${-d}d ago` : `${d}d left`}</div></>} />;
          })}
        </Panel>
        <Panel className="md:col-span-3" eyebrow="Assigned to you" title="My queue" testId="panel-my-queue">
          {data.assurance_pending > 0 && (
            <Link to="/app/assurance" className="flex items-center gap-2 text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-sm px-3 py-2 mb-3" data-testid="dash-assurance-pending">
              <ShieldAlert className="h-4 w-4" /> {data.assurance_pending} high-value cases need Assurance
            </Link>
          )}
          {!data.my_queue.length && <div className="text-sm text-slate-500">Nothing assigned to you right now.</div>}
          {data.my_queue.map((c) => <CaseRow key={c.id} c={c} right={<StatusChip status={c.status} />} />)}
        </Panel>
        <Panel className="md:col-span-12" eyebrow="Workflow" title="Case status" testId="panel-status">
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
            {Object.entries(data.status_counts).map(([s, n]) => (
              <Link key={s} to={`/app/leakages?status=${s}`} className="border border-border rounded-sm p-3 hover:bg-slate-800/50" data-testid={`status-count-${s}`}>
                <StatusChip status={s} /><div className="num text-xl text-white mt-2">{n}</div>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-4">{Object.keys(DOMAINS).map((d) => <DomainBadge key={d} domain={d} />)}</div>
        </Panel>
      </div>
    </div>
  );
}
