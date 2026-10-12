import { cardClass } from "./BusinessUI"
import { formatAmount } from "../lib/businessFinance"

export default function FinanceSummary({ summary, title = "Business sales audit", loading = false }) {
  return <section className="my-6" aria-label={title}>
    <h2 className="text-lg font-semibold text-white">{title}</h2>
    <p className="mt-1 text-sm text-[#777]">Cash and BuzzPoints sales, with refunds shown separately.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <div className={cardClass}><p className="text-sm text-[#777]">Cash sales after refunds</p><p className="mt-3 text-2xl font-bold text-emerald-400">{loading ? "..." : formatAmount(summary.cashNet)} cash</p><p className="mt-2 text-xs text-[#AAA]">Sales: {formatAmount(summary.cashSales)} cash · Refunds: {formatAmount(summary.cashRefunds)} cash</p></div>
      <div className={cardClass}><p className="text-sm text-[#777]">BuzzPoints sales after refunds</p><p className="mt-3 text-2xl font-bold text-[#F5C400]">{loading ? "..." : formatAmount(summary.bpNet)} BP</p><p className="mt-2 text-xs text-[#AAA]">Sales: {formatAmount(summary.bpSales)} BP · Refunds: {formatAmount(summary.bpRefunds)} BP</p></div>
      <div className={cardClass}><p className="text-sm text-[#777]">Completed sales</p><p className="mt-3 text-2xl font-bold text-white">{loading ? "..." : summary.salesCount.toLocaleString()}</p><p className="mt-2 text-xs text-[#AAA]">{summary.cashCount} cash · {summary.bpCount} BuzzPoints</p></div>
    </div>
  </section>
}
