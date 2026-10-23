import { Link } from "react-router-dom";
import { ArrowRight, Store, Truck, Receipt, Percent, PackageX, ShieldCheck, GitBranch, Mail, FileSearch, CreditCard, HandCoins, Wallet, MonitorCog, BadgePercent, CheckCircle2 } from "lucide-react";

const GROUPS = [
  { title: "Partner & channel", items: [
    { icon: Store, t: "Marketplace fees", d: "Amazon referral, FBA and closing fees vs fee schedule", c: "#0284C7" },
    { icon: PackageX, t: "Retail deductions", d: "OTIF & compliance chargebacks vs delivery proof", c: "#2563EB" },
    { icon: CreditCard, t: "Payment processing", d: "Card & chargeback fees vs merchant agreement", c: "#4F46E5" },
  ] },
  { title: "Procurement & payables", items: [
    { icon: Receipt, t: "Supplier price variance", d: "Invoice prices vs special pricing agreements", c: "#D97706" },
    { icon: Truck, t: "Freight overcharge", d: "Carrier bills vs rate card & accessorial caps", c: "#EA580C" },
    { icon: Wallet, t: "Vendor overpayments", d: "Overpaid and duplicate vendor payments", c: "#DC2626" },
    { icon: MonitorCog, t: "SaaS & licenses", d: "Seats and unit prices above the order form", c: "#9333EA" },
  ] },
  { title: "Revenue & receivables", items: [
    { icon: HandCoins, t: "Customer short payments", d: "Partial payments, unearned discounts, overdue invoices, late interest", c: "#059669" },
    { icon: Percent, t: "Rebate shortfall", d: "Volume tiers earned vs rebates paid", c: "#0D9488" },
    { icon: BadgePercent, t: "Royalty underpayment", d: "Royalty rate & minimum guarantees vs statements", c: "#0891B2" },
  ] },
];
const STEPS = [
  { icon: FileSearch, t: "Detect", d: "Upload settlements, invoices, payments and statements. Each line is recomputed against the contract version in force." },
  { icon: GitBranch, t: "Route", d: "Analysts escalate to approvers; high-value claims need independent Assurance sign-off." },
  { icon: Mail, t: "Recover", d: "AI drafts an evidence-backed claim or collection email; approvers send it and track cash to close." },
  { icon: ShieldCheck, t: "Prove", d: "Every decision, email and status change lands in an immutable audit trail." },
];

const HeroCard = () => (
  <div className="panel p-6 shadow-xl shadow-slate-200/60">
    <div className="flex justify-between items-center">
      <span className="eyebrow">Case LK-1031 · Amazon</span>
      <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 font-semibold">Identified</span>
    </div>
    <div className="mt-5 space-y-2.5 text-sm">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 eyebrow"><span>Line</span><span>Contract</span><span>Charged</span></div>
      {[["Referral fee (15% of 12,240)", "1,836.00", "2,080.80"], ["FBA fulfilment (136 units)", "734.40", "836.40"]].map(([l, e, a]) => (
        <div key={l} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-slate-100 pb-2.5">
          <span className="text-slate-700">{l}</span><span className="num text-slate-400">{e}</span><span className="num text-rose-600 font-semibold">{a}</span>
        </div>
      ))}
    </div>
    <div className="flex justify-between items-end mt-6">
      <div><div className="eyebrow">Recoverable</div><div className="num text-3xl font-bold text-slate-900 mt-1">$346.80</div></div>
      <div className="text-right text-xs text-slate-500">Fee Schedule v2 · confidence <span className="num text-emerald-600 font-semibold">96%</span></div>
    </div>
    <div className="mt-5 flex gap-2">
      <span className="flex-1 text-center text-xs py-2 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">AI claim drafted</span>
      <span className="flex-1 text-center text-xs py-2 rounded-lg bg-emerald-600 text-white font-semibold">Escalated → Approver</span>
    </div>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="h-16 flex items-center justify-between px-6 lg:px-12 border-b border-slate-200/80 sticky top-0 z-20 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white font-extrabold text-xs font-mono">LR</div>
          <span className="font-bold text-slate-900" style={{ fontFamily: "Outfit" }}>L&amp;R Accelerator</span>
        </div>
        <div className="flex gap-2">
          <Link to="/sign-in" data-testid="landing-signin-button" className="btn-ghost">Sign in</Link>
          <Link to="/sign-up" data-testid="landing-signup-button" className="btn-primary">Get access</Link>
        </div>
      </header>
      <section className="relative mesh overflow-hidden border-b border-slate-200/70">
        <div className="absolute inset-0 dots opacity-60 pointer-events-none" />
        <div className="relative px-6 lg:px-12 py-20 lg:py-28 grid lg:grid-cols-12 gap-12 items-center max-w-7xl mx-auto">
          <div className="lg:col-span-7 rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Leakage & Recovery Accelerator for finance teams</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mt-6">Find the money that slips through contracts. <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Get it back.</span></h1>
            <p className="text-slate-600 mt-6 max-w-xl text-base">One truth layer of what was agreed, a detection engine for partners, suppliers and customers, and a governed recovery workflow, from junior analyst to CFO.</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/sign-up" data-testid="hero-get-started-button" className="btn-primary px-5 py-3">Start recovering <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/sign-in" data-testid="hero-signin-button" className="btn-secondary px-5 py-3">I have an account</Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-sm text-slate-600">
              {["10 detection scenarios", "Dual-control approvals", "AI-drafted claims"].map((x) => <span key={x} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{x}</span>)}
            </div>
          </div>
          <div className="lg:col-span-5 rise rise-2"><HeroCard /></div>
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20 max-w-7xl mx-auto">
        <div className="eyebrow text-emerald-600 mb-3">Scenario library</div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-10">One engine. Ten places money leaks.</h2>
        <div className="grid lg:grid-cols-3 gap-6">
          {GROUPS.map((g) => (
            <div key={g.title} className="rounded-2xl bg-slate-50 border border-slate-200/80 p-5">
              <div className="text-sm font-bold text-slate-900 mb-4">{g.title}</div>
              <div className="space-y-3">
                {g.items.map((d) => (
                  <div key={d.t} className="panel p-4 flex gap-3 hover:-translate-y-0.5 transition-transform duration-200">
                    <div className="h-9 w-9 shrink-0 rounded-lg grid place-items-center" style={{ background: `${d.c}14`, color: d.c }}><d.icon className="h-4 w-4" /></div>
                    <div><div className="text-sm font-semibold text-slate-900">{d.t}</div><div className="text-xs text-slate-500 mt-0.5">{d.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20 border-t border-slate-200/70 bg-slate-50">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.t} className="panel p-6">
              <div className="flex items-center justify-between"><div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 grid place-items-center"><s.icon className="h-5 w-5" /></div><span className="num text-xs text-slate-400">0{i + 1}</span></div>
              <div className="text-lg font-bold mt-4" style={{ fontFamily: "Outfit" }}>{s.t}</div>
              <p className="text-sm text-slate-500 mt-2">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="px-6 lg:px-12 py-8 border-t border-slate-200/70 text-xs text-slate-500 flex flex-col sm:flex-row gap-2 justify-between">
        <span>© 2026 L&amp;R Accelerator</span><span>Analyst · Approver · Assurance · Rule Author · Admin · Viewer / CFO</span>
      </footer>
    </div>
  );
}
