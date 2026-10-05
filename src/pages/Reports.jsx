import { BarChart3, Download, TrendingUp } from "lucide-react"
import { useState } from "react"
import { useBusiness } from "../businessContext"
import { Button, PageHeader, cardClass } from "../components/BusinessUI"

const periods = ["7 Days", "30 Days", "90 Days", "This Year"]
const isCompleted = (item) => String(item.status || "").toUpperCase() === "COMPLETED"

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
    ledger,
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
  const customerPurchases = completedTransactions.filter((item) => item.type === "CUSTOMER_PURCHASE")
  const completedLedger = ledger.filter((item) => isCompleted(item) && inPeriod(item.created_at))
  const collectedPoints = completedLedger
    .filter((item) => item.type === "CUSTOMER_PURCHASE")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const purchaseVolume = customerPurchases.reduce((sum, item) => sum + Number(item.amount || 0), 0)
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
      amount: 0,
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
    if (index >= 0) buckets[index].amount += Number(item.amount || 0)
  })
  const maxVolume = Math.max(...buckets.map((item) => item.amount), 1)
  const reportRows = [
    ["Customer purchases (BP)", purchaseVolume],
    ["Buzz Points collected", collectedPoints],
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
      ["Period bucket", "Customer purchases (BP)"],
      ...buckets.map((item) => [item.label, item.amount]),
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Customer purchases (BP)", `${purchaseVolume.toLocaleString()} BP`],
          ["Buzz Points collected", `${collectedPoints.toLocaleString()} BP`],
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
            <h2 className="text-lg font-semibold text-white">Customer purchase volume (BP)</h2>
            <p className="mt-1 text-sm text-[#666]">{period} completed customer purchases</p>
          </div>
          <TrendingUp className="text-[#F5C400]" />
        </div>
        <div className="mt-8 flex h-56 items-end gap-3" aria-label={`${period} customer purchase volume chart`}>
          {buckets.map((item, index) => (
            <div className="flex h-full flex-1 flex-col justify-end" key={`${item.label}-${index}`}>
              <div title={`${item.label}: ${item.amount.toLocaleString()} BP`} className="w-full rounded-t-lg bg-[#F5C400]/25 hover:bg-[#F5C400]" style={{ height: `${item.amount ? Math.max((item.amount / maxVolume) * 100, 3) : 0}%` }} />
              <span className="mt-2 text-center text-[10px] text-[#777]">{item.label}</span>
            </div>
          ))}
        </div>
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
