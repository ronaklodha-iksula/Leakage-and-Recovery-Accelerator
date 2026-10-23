import { DOMAINS, STATUS, money } from "@/lib/format";

export const StatusChip = ({ status, testId }) => {
  const s = STATUS[status] || { label: status, cls: "" };
  return (
    <span data-testid={testId || `status-chip-${status}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
};

export const DomainBadge = ({ domain }) => {
  const d = DOMAINS[domain] || { short: domain, color: "#64748b" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ color: d.color, background: `${d.color}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
      {d.short}
    </span>
  );
};

export const SeverityDot = ({ severity }) => {
  const c = { high: "bg-rose-500", medium: "bg-amber-400", low: "bg-slate-300" }[severity] || "bg-slate-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} title={`${severity} severity`} />;
};

export const Money = ({ value, cur, className = "", compact }) => <span className={`num font-semibold ${className}`}>{money(value, cur, compact)}</span>;

export const PageHeader = ({ eyebrow, title, desc, children }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8 rise">
    <div>
      {eyebrow && <div className="eyebrow text-emerald-600 mb-2">{eyebrow}</div>}
      <h1 className="text-3xl sm:text-4xl font-bold" data-testid="page-title">{title}</h1>
      {desc && <p className="text-sm text-slate-500 mt-2 max-w-2xl">{desc}</p>}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export const Empty = ({ title, desc, testId = "empty-state" }) => (
  <div data-testid={testId} className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
    <div className="text-slate-800 font-semibold">{title}</div>
    {desc && <div className="text-sm text-slate-500 mt-1">{desc}</div>}
  </div>
);

export const Panel = ({ title, eyebrow, action, children, className = "", testId }) => (
  <section data-testid={testId} className={`panel p-5 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          {title && <h3 className="text-base font-semibold">{title}</h3>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);
