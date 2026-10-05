import { Activity, Coins, Users, WalletCards } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Status, cardClass } from "../components/BusinessUI"

const completed = (item) => String(item.status || "").toUpperCase() === "COMPLETED"

function Dashboard() {
  const {
    wallet,
    customers,
    transactions,
    ledger,
    cards,
    workstations,
    dataLoading,
    dataError,
  } = useBusiness()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const customerPurchases = transactions.filter(
    (item) => item.type === "CUSTOMER_PURCHASE" && completed(item),
  )
  const todaysPurchases = customerPurchases.filter(
    (item) => new Date(item.created_at) >= todayStart,
  )
  const monthlyVolumes = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
    return {
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: month.toLocaleDateString(undefined, { month: "short" }),
      amount: 0,
    }
  })
  const bucketMap = new Map(monthlyVolumes.map((bucket) => [bucket.key, bucket]))
  customerPurchases.forEach((item) => {
    const date = new Date(item.created_at)
    const bucket = bucketMap.get(`${date.getFullYear()}-${date.getMonth()}`)
    if (bucket) bucket.amount += Number(item.amount || 0)
  })
  const maxVolume = Math.max(...monthlyVolumes.map((item) => item.amount), 1)
  const recentActivity = [
    ...transactions
      .filter(completed)
      .map((item) => ({
        id: `transaction-${item.id}`,
        action: item.type.replaceAll("_", " "),
        target: item.customer,
        amount: item.amount,
        timestamp: item.created_at,
        reference: item.id,
      })),
    ...ledger
      .filter(completed)
      .map((item) => ({
        id: `ledger-${item.id}`,
        action: item.type.replaceAll("_", " "),
        target: customers.find((customer) => customer.id === item.customer_id)?.name || "Business wallet",
        amount: item.amount,
        timestamp: item.created_at,
        reference: item.reference || item.id,
      })),
  ]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 3)
  const stats = [
    {
      label: "Today's Customer Purchases",
      value: `${todaysPurchases.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString()} BP`,
      description: "Completed transaction amounts",
    },
    {
      label: "Today's Completed Transactions",
      value: String(transactions.filter((item) => completed(item) && new Date(item.created_at) >= todayStart).length),
      description: "All transaction types",
    },
    {
      label: "Active NFC Cards",
      value: String(cards.filter((item) => item.status === "ACTIVE").length),
      description: "From registered card records",
    },
    {
      label: "Available Workstations",
      value: String(workstations.filter((item) => item.status === "ACTIVE").length),
      description: "Ready for a session",
    },
    {
      label: "Available Customized Buzz Points",
      value: `${(wallet.purchased - wallet.distributed).toLocaleString()} BP`,
      description: "Purchased less distributed",
    },
  ]

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-[#F5C400]">OVERVIEW</p>
        <h1 className="text-4xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="mt-2 text-[#777]">Business activity from your connected records.</p>
      </div>

      {(dataLoading || dataError) && (
        <p role={dataError ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#333] bg-[#111] text-[#AAA]"}`}>
          {dataError ? `Business data could not be loaded: ${dataError}` : "Loading business data…"}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="group rounded-2xl border border-[#222] bg-[#111] p-6 shadow-[8px_8px_25px_rgba(0,0,0,0.35),-5px_-5px_20px_rgba(255,255,255,0.015)] transition-all duration-300 hover:-translate-y-1 hover:border-[#F5C400]/40 hover:shadow-[0_12px_35px_rgba(245,196,0,0.08)]">
            <p className="text-sm text-[#777]">{stat.label}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{dataLoading ? "…" : stat.value}</h2>
            <p className="mt-3 text-xs text-[#F5C400]">{stat.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className={cardClass}><div className="flex items-center gap-3"><Coins className="text-[#F5C400]" /><div><p className="text-sm text-[#777]">Customized Buzz Points Collected</p><p className="mt-1 text-2xl font-bold text-white">{wallet.collected.toLocaleString()} BP</p></div></div></div>
        <div className={cardClass}><div className="flex items-center gap-3"><Users className="text-[#F5C400]" /><div><p className="text-sm text-[#777]">Active Customers</p><p className="mt-1 text-2xl font-bold text-white">{customers.filter((item) => item.status === "ACTIVE").length}</p></div></div></div>
        <div className={cardClass}><div className="flex items-center gap-3"><WalletCards className="text-[#F5C400]" /><div><p className="text-sm text-[#777]">Pending Settlement</p><p className="mt-1 text-2xl font-bold text-white">{wallet.pendingSettlement.toLocaleString()} BP</p></div></div></div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${cardClass} min-h-[320px] xl:col-span-2`}>
          <h2 className="text-lg font-semibold text-white">Customer purchase volume</h2>
          <p className="mt-1 text-sm text-[#666]">Completed customer purchases, in BP, by month</p>
          <div className="mt-8 flex h-48 items-end gap-3" aria-label="Monthly customer purchase volume chart">
            {monthlyVolumes.map((item) => (
              <div key={item.key} className="flex h-full flex-1 flex-col justify-end">
                <div title={`${item.label}: ${item.amount.toLocaleString()} BP`} className="w-full rounded-t-lg bg-[#F5C400]/30 transition-colors hover:bg-[#F5C400]" style={{ height: `${item.amount ? Math.max((item.amount / maxVolume) * 100, 3) : 0}%` }} />
                <span className="mt-2 text-center text-[10px] text-[#777]">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-white">Operational counts</h2>
          <p className="mt-1 text-sm text-[#666]">Current business records</p>
          <div className="mt-8 space-y-5">
            <StatusItem name="Active NFC cards" value={cards.filter((item) => item.status === "ACTIVE").length} />
            <StatusItem name="Workstations in use" value={workstations.filter((item) => item.status === "IN_USE").length} />
            <StatusItem name="Stations in maintenance" value={workstations.filter((item) => item.status === "MAINTENANCE").length} />
          </div>
        </section>
      </div>

      <section className={`${cardClass} mt-6`}>
        <div className="flex items-center gap-3"><Activity size={19} className="text-[#F5C400]" /><div><h2 className="text-lg font-semibold text-white">Recent activity</h2><p className="text-sm text-[#666]">Latest completed transaction and ledger events</p></div></div>
        {recentActivity.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {recentActivity.map((item) => (
              <div className="border-t border-[#242424] pt-3" key={item.id}>
                <p className="text-sm capitalize text-white">{item.action}</p>
                <p className="mt-1 text-xs text-[#777]">{item.target} · {new Date(item.timestamp).toLocaleString()}</p>
                <Status>{Number(item.amount || 0).toLocaleString()} BP · {item.reference}</Status>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-[#777]">{dataLoading ? "Loading activity…" : "No completed activity yet."}</p>
        )}
      </section>
    </div>
  )
}

function StatusItem({ name, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#AAA]">{name}</span>
      <span className="text-sm font-semibold text-[#F5C400]">{value}</span>
    </div>
  )
}

export default Dashboard
