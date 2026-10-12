import { BarChart3, Download, TrendingUp } from "lucide-react"
import { useState } from "react"
import { useBusiness } from "../businessContext"
import { Button, PageHeader, cardClass } from "../components/BusinessUI"
import FinanceSummary from "../components/FinanceSummary"
import SalesChart from "../components/SalesChart"
import { isCompleted, isSale, isRefund, summarizeFinance } from "../lib/businessFinance"

const periods = ["7 Days", "30 Days", "90 Days", "This Year"]

function rangeFor(period, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const start = period === "This Year"
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(end.getTime() - Number.parseInt(period, 10) * 24 * 60 * 60 * 1000)
  return { start, end }
}

function Reports() {
  const [period, setPeriod] = useState("30 Days")
  const {
    transactions,
    financeAudit,
    rebateLedger,
    customers,
    inventoryMovements,
    workstationSessions,
    dataLoading,
    dataError,
  } = useBusiness()
  const now = new Date()
  const { start, end } = rangeFor(period, now)
  const inPeriod = (value) => {
    const date = new Date(value)
    return date >= start && date < end
  }
  const periodTransactions = transactions.filter((item) => inPeriod(item.created_at))
  const completedTransactions = periodTransactions.filter(isCompleted)
  const periodAudit = financeAudit.filter((item) => inPeriod(item.created_at))
  const finance = summarizeFinance(periodAudit)
  const periodRebates = rebateLedger.filter((item)=>inPeriod(item.created_at))
  const rebatesIssued = periodRebates.filter((item)=>item.kind === "EARN").reduce((sum,item)=>sum+Number(item.amount),0)
  const rebatesReversed = periodRebates.filter((item)=>item.kind === "REVERSAL").reduce((sum,item)=>sum+Number(item.amount),0)
  const customerPurchases = periodAudit.filter((item) => isSale(item) && (isCompleted(item) || item.status === "REFUNDED"))
  const salesAudit = periodAudit.filter((item) => (isSale(item) || isRefund(item)) && (isCompleted(item) || (isSale(item) && item.status === "REFUNDED")))
  const newCustomers = customers.filter((item) => inPeriod(item.created_at)).length
  const issues = inventoryMovements.filter((item) => item.movement_type === "ISSUE" && inPeriod(item.created_at))
  const productIssues = new Map()
  issues.forEach((item) => {
    productIssues.set(item.product_id, (productIssues.get(item.product_id) || 0) + Number(item.quantity || 0))
  })
  const topProducts = [...productIssues.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5)
  const completedSessions = workstationSessions.filter(
    (item) => item.status === "COMPLETED" && inPeriod(item.started_at),
  )
  const totalSessionHours = completedSessions.reduce((sum, item) => {
    const duration = new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()
    return sum + Math.max(duration, 0) / 3_600_000
  }, 0)
  const bucketCount = period === "7 Days" ? 7 : 12
  const interval = end.getTime() - start.getTime()
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = period === "This Year"
      ? new Date(now.getFullYear(), index, 1)
      : new Date(start.getTime() + (interval * index) / bucketCount)
    return {
      label: period === "This Year"
        ? bucketStart.toLocaleDateString(undefined, { month: "short" })
        : bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      cash: 0,
      bp: 0,
      cbp: 0,
    }
  })
  customerPurchases.forEach((item) => {
    const date = new Date(item.created_at)
    const index = period === "This Year"
      ? date.getMonth()
      : Math.min(
        bucketCount - 1,
        Math.floor(((date.getTime() - start.getTime()) / interval) * bucketCount),
      )
    if (index >= 0) buckets[index][item.paymentMethod === "CASH" ? "cash" : item.paymentMethod === "CUSTOMIZED" ? "cbp" : "bp"] += Number(item.amount || 0)
  })
  const reportRows = [
    ["Cash sales (cash)", finance.cashSales],
    ["Cash refunds (cash)", finance.cashRefunds],
    ["Net cash sales (cash)", finance.cashNet],
    ["BuzzPoints sales (BP)", finance.bpSales],
    ["BuzzPoints refunds (BP)", finance.bpRefunds],
    ["Net BuzzPoints sales (BP)", finance.bpNet],
    ["Customized BP redeemed (CBP)",finance.cbpSales],
    ["Customized BP refunds (CBP)",finance.cbpRefunds],
    ["Net Customized BP redemptions (CBP)",finance.cbpNet],
    ["Rebates issued (CBP)",rebatesIssued],
    ["Rebates reversed (CBP)",rebatesReversed],
    ["Completed sales (cash and BP)", finance.salesCount],
    ["New customers", newCustomers],
    ["Completed transactions", completedTransactions.length],
    ["Inventory items issued", issues.reduce((sum, item) => sum + Number(item.quantity || 0), 0)],
    ["Completed workstation session hours", totalSessionHours.toFixed(2)],
  ]

  const exportCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ...reportRows,
      [],
      ["Period bucket", "Cash sales (cash)", "BuzzPoints sales (BP)", "Customized BP redemptions (CBP)"],
      ...buckets.map((item) => [item.label, item.cash, item.bp, item.cbp]),
      [],
      ["Record ID", "Source", "Type", "Payment method", "Amount", "Unit", "Customer", "Product ID", "Quantity", "Workstation", "Operator", "Date", "Original transaction"],
      ...salesAudit.map((item) => [item.id, item.source, item.type, item.paymentMethod, item.amount, item.unit,
        item.customer || customers.find((customer) => customer.id === item.customer_id)?.name || "Business wallet",
        item.metadata?.product_id || "", item.metadata?.quantity || "", item.workstation_id || "",
        item.operatorName || item.created_by || "", item.created_at, item.metadata?.original_transaction_id || ""]),
      [],
      ["Product ID", "Inventory items issued"],
      ...topProducts.map((item) => [item.productId, item.quantity]),
    ]
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    link.download = `buzztap-report-${period.toLowerCase().replaceAll(" ", "-")}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow="ANALYTICS"
        title="Reports"
        description="Business activity calculated from completed transaction, ledger, inventory, and session records."
        action={<Button secondary onClick={exportCsv}><Download size={17} />Export CSV</Button>}
      />
      {(dataLoading || dataError) && (
        <p role={dataError ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#333] bg-[#111] text-[#AAA]"}`}>
          {dataError ? `Business data could not be loaded: ${dataError}` : "Loading business data…"}
        </p>
      )}
      <div className="mb-6 flex gap-2 overflow-auto">
        {periods.map((item) => (
          <button key={item} onClick={() => setPeriod(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${period === item ? "bg-[#F5C400] text-black" : "bg-[#191919] text-[#777]"}`}>
            {item}
          </button>
        ))}
      </div>
      <FinanceSummary summary={finance} loading={dataLoading} title={`Business sales audit · ${period}`} />
      <div className={`${cardClass} mb-5`}><h2 className="font-semibold text-white">Business-only rebate activity · {period}</h2><p className="mt-2 text-sm text-[#AAA]">{rebatesIssued} CBP issued · {rebatesReversed} CBP reversed after refunds. These rewards do not add to shared BP collections or settlement amounts.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["New customers", String(newCustomers)],
          ["Completed transactions", String(completedTransactions.length)],
        ].map(([label, value]) => (
          <div className={cardClass} key={label}>
            <p className="text-sm text-[#777]">{label}</p>
            <p className="mt-3 text-2xl font-bold text-white">{dataLoading ? "…" : value}</p>
            <p className="mt-2 text-xs text-[#F5C400]">{period} · completed records where applicable</p>
          </div>
        ))}
      </div>
      <section className={`${cardClass} mt-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Cash, BP and CBP activity</h2>
            <p className="mt-1 text-sm text-[#666]">{period} gross sales in their original payment units</p>
          </div>
          <TrendingUp className="text-[#F5C400]" />
        </div>
        <SalesChart buckets={buckets} label={`${period} cash and BuzzPoints sales chart`} />
      </section>
      <section className={`${cardClass} mt-6`}>
        <h2 className="text-lg font-semibold text-white">Combined cash, BP and CBP audit</h2>
        <p className="mt-1 text-sm text-[#777]">Sales and refunds for {period}. Export CSV includes every record in this period.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-[#292929] text-xs text-[#777]"><tr>{["Reference", "Customer", "Type", "Payment", "Amount", "Operator", "Date"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
          <tbody>{salesAudit.slice(0, 50).map((item) => <tr key={`${item.source}-${item.id}`} className="border-b border-[#222] text-[#AAA]">
            <td className="p-3">{item.id}</td><td className="p-3">{item.customer || customers.find((customer) => customer.id === item.customer_id)?.name || "Business wallet"}</td>
            <td className="p-3">{item.type}</td><td className="p-3">{item.paymentMethod === "CASH" ? "Cash" : "BuzzPoints"}</td>
            <td className="p-3 text-white">{Number(item.amount).toLocaleString()} {item.unit}</td><td className="p-3">{item.operatorName || item.created_by || "Unknown member"}</td><td className="p-3">{new Date(item.created_at).toLocaleString()}</td>
          </tr>)}</tbody>
        </table></div>
        {!salesAudit.length && <p className="mt-4 text-sm text-[#777]">No sales or refunds in this period.</p>}
        {salesAudit.length > 50 && <p className="mt-4 text-xs text-[#777]">Showing the latest 50 of {salesAudit.length} records. Export CSV for the full audit.</p>}
      </section>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className={cardClass}>
          <BarChart3 className="mb-3 text-[#F5C400]" size={19} />
          <p className="font-semibold text-white">Most issued products</p>
          {topProducts.length ? topProducts.map((item) => (
            <p className="mt-2 text-sm text-[#777]" key={item.productId}>{item.productId} · {item.quantity} issued</p>
          )) : <p className="mt-1 text-sm text-[#777]">No recorded inventory issues in this period.</p>}
        </div>
        <div className={cardClass}>
          <BarChart3 className="mb-3 text-[#F5C400]" size={19} />
          <p className="font-semibold text-white">Workstation sessions</p>
          <p className="mt-1 text-sm text-[#777]">{completedSessions.length} completed · {totalSessionHours.toFixed(1)} hours</p>
        </div>
        <div className={cardClass}>
          <BarChart3 className="mb-3 text-[#F5C400]" size={19} />
          <p className="font-semibold text-white">Promotions</p>
          <p className="mt-1 text-sm text-[#777]">Promotion performance needs redemption/impression records before it can be reported.</p>
        </div>
      </div>
    </div>
  )
}

export default Reports
