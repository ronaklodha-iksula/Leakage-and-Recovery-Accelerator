import { Link } from "react-router-dom";
import { ArrowRight, Store, Truck, Receipt, Percent, PackageX, ShieldCheck, GitBranch, Mail, FileSearch, CreditCard, HandCoins, Wallet, MonitorCog, BadgePercent } from "lucide-react";

const DOMAINS = [
  { icon: Store, title: "Marketplace fees", desc: "Amazon referral, FBA and closing fees re-computed against your fee schedule.", color: "#3b82f6" },
  { icon: PackageX, title: "Retail deductions", desc: "OTIF and compliance chargebacks checked against delivery proof.", color: "#ec4899" },
  { icon: CreditCard, title: "Payment processing", desc: "Card and chargeback fees vs your merchant agreement.", color: "#6366f1" },
  { icon: Receipt, title: "Supplier price variance", desc: "Invoice lines vs special pricing agreements, plus duplicates.", color: "#06b6d4" },
  { icon: Truck, title: "Freight overcharge", desc: "Carrier bills vs rate card, fuel and accessorial caps.", color: "#f97316" },
  { icon: Wallet, title: "Vendor overpayments", desc: "Overpaid invoices and the same invoice paid twice.", color: "#dc2626" },
  { icon: MonitorCog, title: "SaaS & licenses", desc: "Seats and unit prices above the order form.", color: "#9333ea" },
  { icon: HandCoins, title: "Customer short payments", desc: "Partial payments, unearned discounts, overdue invoices, late interest.", color: "#10b981" },
  { icon: Percent, title: "Rebate shortfall", desc: "Volume tiers reached vs rebates actually paid out.", color: "#8b5cf6" },
  { icon: BadgePercent, title: "Royalty underpayment", desc: "Royalty rate and minimum guarantees vs licensee statements.", color: "#0891b2" },
];
const STEPS = [
  { icon: FileSearch, t: "Detect", d: "Upload settlements, invoices, payments and statements. The engine checks each line against the published contract version." },
  { icon: GitBranch, t: "Route", d: "Analysts escalate to approvers. High-value claims need independent Assurance sign-off." },
  { icon: Mail, t: "Recover", d: "AI drafts an evidence-backed claim or collection email; approvers send it and track cash to close." },
  { icon: ShieldCheck, t: "Prove", d: "Every decision, email and status change lands in an immutable audit trail." },
];
const TICKER = ["Referral fee 17% vs 15% contracted", "OTIF deduction on on-time PO", "Customer short-paid invoice by $2,400", "Duplicate vendor payment", "Rebate paid at 2% tier vs 3% earned", "SaaS billed 240 seats vs 215 in use", "Early-pay discount taken after window", "Royalty below minimum guarantee"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 flex items-center justify-between px-6 lg:px-12 border-b border-border sticky top-0 z-20 bg-white/85 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-sm bg-emerald-600 grid place-items-center text-white font-black text-xs font-mono">LR</div>
          <span className="font-semibold text-slate-900" style={{ fontFamily: "Outfit" }}>L&amp;R Accelerator</span>
        </div>
        <div className="flex gap-2">
          <Link to="/sign-in" data-testid="landing-signin-button" className="btn-ghost">Sign in</Link>
          <Link to="/sign-up" data-testid="landing-signup-button" className="btn-primary">Get access</Link>
        </div>
      </header>
      <div className="border-b border-border overflow-hidden py-2 bg-white">
        <div className="ticker flex gap-10 whitespace-nowrap w-max">
          {[...TICKER, ...TICKER].map((t, i) => <span key={i} className="text-xs font-mono text-slate-500"><span className="text-rose-600">▲ LEAK</span> {t}</span>)}
        </div>
      </div>
      <section className="relative grain grid-bg px-6 lg:px-12 py-20 lg:py-28 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 rise">
          <div className="eyebrow text-emerald-600 mb-5">For CFOs, controllers & AR/AP teams</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05]">Find the money that slips through contracts. <span className="text-emerald-600">Get it back.</span></h1>
          <p className="text-slate-600 mt-6 max-w-xl text-base">A truth layer of what was agreed, a detection engine that checks every partner, supplier and customer transaction against it, and a governed recovery workflow, from junior analyst to CFO.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/sign-up" data-testid="hero-get-started-button" className="btn-primary px-5 py-3">Start recovering <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/sign-in" data-testid="hero-signin-button" className="btn-secondary px-5 py-3">I have an account</Link>
          </div>
        </div>
        <div className="lg:col-span-5 rise rise-2">
          <div className="panel p-5 shadow-xl shadow-slate-200/70">
            <div className="flex justify-between items-center"><span className="eyebrow">Case LK-1031 · Amazon</span><span className="text-[11px] px-2 py-0.5 rounded-sm border border-amber-200 bg-amber-50 text-amber-800">Identified</span></div>
            <div className="mt-4 space-y-2 text-sm">
              {[["Referral fee (15% of 12,240.00)", "1,836.00", "2,080.80"], ["Fulfilment fee (136 units)", "734.40", "836.40"]].map(([l, e, a]) => (
                <div key={l} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border pb-2">
                  <span className="text-slate-700">{l}</span><span className="num text-slate-500">{e}</span><span className="num text-rose-600">{a}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-end mt-5">
              <div><div className="eyebrow">Recoverable</div><div className="num text-3xl text-slate-900 mt-1">$346.80</div></div>
              <div className="text-right text-xs text-slate-500">Cited: Fee Schedule v2<br />Confidence <span className="num text-emerald-600">96%</span></div>
            </div>
          </div>
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20 border-t border-border bg-white">
        <div className="eyebrow mb-3">Leakage scenarios</div>
        <h2 className="text-2xl sm:text-3xl font-semibold mb-10">One engine. Ten places money leaks.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {DOMAINS.map((d) => (
            <div key={d.title} className="panel p-5 hover:-translate-y-1 transition-transform duration-200" style={{ borderTop: `2px solid ${d.color}` }}>
              <d.icon className="h-5 w-5" style={{ color: d.color }} />
              <div className="text-slate-900 font-semibold mt-4">{d.title}</div>
              <p className="text-sm text-slate-500 mt-2">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="px-6 lg:px-12 py-20 border-t border-border grid lg:grid-cols-4 gap-8">
        {STEPS.map((s, i) => (
          <div key={s.t}>
            <div className="num text-xs text-emerald-600">0{i + 1}</div>
            <s.icon className="h-5 w-5 text-slate-600 mt-3" />
            <div className="text-lg text-slate-900 font-semibold mt-3" style={{ fontFamily: "Outfit" }}>{s.t}</div>
            <p className="text-sm text-slate-500 mt-2">{s.d}</p>
          </div>
        ))}
      </section>
      <footer className="px-6 lg:px-12 py-8 border-t border-border text-xs text-slate-500 flex flex-col sm:flex-row gap-2 justify-between bg-white">
        <span>© 2026 L&amp;R Accelerator</span><span>Analyst · Approver · Assurance · Rule Author · Admin · Viewer / CFO</span>
      </footer>
    </div>
  );
}
