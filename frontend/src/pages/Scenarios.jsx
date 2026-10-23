import { Link } from "react-router-dom";
import { useData } from "@/lib/api";
import { DOMAINS, GROUPS, money } from "@/lib/format";
import { PageHeader, Empty } from "@/components/common";

const DATA = {
  MARKETPLACE_FEE: "Marketplace settlement / fee reports",
  RETAIL_DEDUCTION: "Retailer deduction & chargeback notices + POD",
  PAYMENT_PROCESSING: "Processor settlement statements",
  PRICE_VARIANCE: "Supplier invoice lines",
  FREIGHT: "Carrier freight bills",
  AP_PAYMENT: "AP payment run / bank payment export",
  SAAS_LICENSE: "SaaS vendor invoices + seat usage",
  AR_RECEIVABLE: "AR ledger: invoices, credits and cash receipts",
  REBATE: "Rebate statements + purchase volume",
  ROYALTY: "Licensee royalty statements",
};

export default function Scenarios() {
  const domains = useData("/domains").data;
  const dash = useData("/dashboard").data;
  if (!domains || !dash) return <div className="eyebrow">Loading scenarios…</div>;
  const stats = Object.fromEntries(dash.by_domain.map((d) => [d.domain, d]));
  return (
    <div>
      <PageHeader eyebrow="Scenario library" title="Where money leaks — and how we catch it"
        desc="Ten detection scenarios across partners, suppliers and customers. Each one recomputes what you should have paid or received from the contract terms, then flags the gap." />
      {!domains.length && <Empty title="No scenarios" />}
      <div className="space-y-10">
        {GROUPS.map((g) => (
          <section key={g} data-testid={`scenario-group-${g.split(" ")[0].toLowerCase()}`}>
            <h2 className="text-lg font-bold mb-4">{g}</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {domains.filter((d) => d.group === g).map((d) => {
                const meta = DOMAINS[d.key];
                const s = stats[d.key];
                return (
                  <Link key={d.key} to={`/app/leakages?domain=${d.key}`} data-testid={`scenario-card-${d.key}`}
                    className="panel p-5 flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow] duration-200">
                    <div className="h-9 w-9 rounded-lg grid place-items-center text-white text-xs font-bold" style={{ background: meta.color }}>{meta.short.slice(0, 2).toUpperCase()}</div>
                    <div className="font-semibold text-slate-900 mt-4">{d.label}</div>
                    <p className="text-sm text-slate-500 mt-1.5 flex-1">{d.desc}</p>
                    <div className="text-[11px] text-slate-400 mt-3">Data: {DATA[d.key]}</div>
                    <div className="flex justify-between items-end border-t border-slate-100 mt-4 pt-3">
                      <div><div className="eyebrow">Found</div><div className="num font-semibold text-amber-700">{money(s?.identified || 0)}</div></div>
                      <div className="text-right"><div className="eyebrow">Recovered</div><div className="num font-semibold text-emerald-700">{money(s?.recovered || 0)}</div></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
