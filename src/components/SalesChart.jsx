import { formatAmount } from "../lib/businessFinance"

export default function SalesChart({ buckets, label }) {
  const maximum = Math.max(1, ...buckets.flatMap((item) => [item.cash, item.bp]))
  return <>
    <div className="mt-4 flex gap-5 text-xs text-[#AAA]"><span><span className="mr-2 inline-block h-2 w-2 bg-emerald-400" />Cash sales</span><span><span className="mr-2 inline-block h-2 w-2 bg-[#F5C400]" />BP sales</span></div>
    <div className="mt-8 flex h-56 items-end gap-3" aria-label={label}>
      {buckets.map((item, index) => <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
        <div className="flex min-h-0 flex-1 items-end justify-center gap-1">
          <div title={`${item.label}: ${formatAmount(item.cash)} cash`} className="w-1/2 rounded-t bg-emerald-400/70" style={{ height: `${item.cash ? Math.max(item.cash / maximum * 100, 3) : 0}%` }} />
          <div title={`${item.label}: ${formatAmount(item.bp)} BP`} className="w-1/2 rounded-t bg-[#F5C400]/70" style={{ height: `${item.bp ? Math.max(item.bp / maximum * 100, 3) : 0}%` }} />
        </div>
        <span className="mt-2 text-center text-[10px] text-[#777]">{item.label}</span>
      </div>)}
    </div>
  </>
}
