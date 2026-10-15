import { useState } from "react"
import { Eye, Printer, Receipt, RotateCcw, Search } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, Modal, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"
import FinanceSummary from "../components/FinanceSummary"
import CustomerPaymentDisputes from "../components/CustomerPaymentDisputes"
import { paymentMethod, paymentUnit, formatAmount, isRefund, summarizeFinance } from "../lib/businessFinance"

const statuses = ["ALL", "COMPLETED", "PENDING", "FAILED", "REFUNDED"]

function Transactions() {
  const { transactions, refund, showReceipt, dataLoading, dataError } = useBusiness()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("ALL")
  const [method, setMethod] = useState("ALL")
  const [notice, setNotice] = useState("")
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [refundingId, setRefundingId] = useState(null)
  const visible = transactions.filter((item) =>
    (filter === "ALL" || (filter === "REFUNDED" ? isRefund(item) || item.status === "REFUNDED" : item.status === filter))
    && (method === "ALL" || paymentMethod(item, transactions) === method)
    && `${item.id} ${item.customer} ${item.card} ${item.operatorName}`.toLowerCase().includes(query.toLowerCase()),
  )

  const doRefund = async (item) => {
    const confirmed = window.confirm(
      `Return ${item.amount} ${paymentUnit(item)} to ${item.customer}'s ${item.type === "CUSTOMIZED_PURCHASE" ? "business-only CBP" : "shared BP"} wallet?`,
    )
    if (!confirmed) return
    setRefundingId(item.id)
    setNotice("")
    const result = await refund(item)
    setNotice(result.success
      ? `${paymentUnit(item)} payment refunded to ${item.customer}.`
      : result.error || "Refund could not be completed.")
    setRefundingId(null)
  }

  const exportCsv = () => {
    const rows = [
      ["Transaction ID", "Customer", "NFC Card", "Type", "Payment method", "Amount", "Unit", "Status", "Operator", "Date"],
      ...visible.map((item) => [item.id, item.customer, item.card, item.type, paymentMethod(item, transactions), item.amount, paymentUnit(item), item.status, item.operatorName, item.date]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    link.download = `buzzTap-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    setNotice("CSV exported successfully.")
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader eyebrow="LEDGER" title="Transactions" description="Cash and BuzzPoints sales, shared wallet loads, and refunds." action={<Button secondary onClick={exportCsv}><Receipt size={17} />Export CSV</Button>} />
      {(notice || dataError || dataLoading) && (
        <p role={dataError ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#F5C400]/30 bg-[#F5C400]/10 text-[#F5C400]"}`}>
          {dataError ? `Database error: ${dataError}` : notice || "Loading transactions…"}
        </p>
      )}
      <FinanceSummary summary={summarizeFinance(visible.map((item) => ({ ...item, paymentMethod: paymentMethod(item, transactions) })))} loading={dataLoading} title="Sales audit · filtered transactions" />
      <div className={`${cardClass} mb-6 flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between`}>
        <label className="text-xs text-[#AAA]">Payment method<select className={`${inputClass} mt-2`} value={method} onChange={(event) => setMethod(event.target.value)}><option value="ALL">Cash, BP and CBP</option><option value="CASH">Cash</option><option value="BUZZPOINTS">BuzzPoints</option><option value="CUSTOMIZED">Customized BuzzPoints</option></select></label>
        <div className="relative w-full md:max-w-md">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
          <input className={`${inputClass} pl-10`} placeholder="Search transaction, customer, card, or operator" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="flex gap-2 overflow-auto">
          {statuses.map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? "bg-[#F5C400] text-black" : "bg-[#1c1c1c] text-[#777]"}`}>{item}</button>)}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#222] bg-[#111]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left">
            <thead className="border-b border-[#242424] text-xs uppercase tracking-wider text-[#666]"><tr>
              <th className="px-5 py-4">Transaction</th><th className="px-5 py-4">Customer / Card</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Operator</th><th className="px-5 py-4">Date</th><th className="px-5 py-4">Actions</th>
            </tr></thead>
            <tbody>
              {visible.length ? visible.map((item) => (
                <tr className="border-b border-[#1d1d1d] last:border-0" key={`${item.id}-${item.type}`}>
                  <td className="px-5 py-4 font-medium text-white">{item.id}</td>
                  <td className="px-5 py-4"><p className="text-sm text-white">{item.customer}</p><p className="text-xs text-[#666]">{item.card} · {item.workstation}</p></td>
                  <td className="px-5 py-4 text-xs text-[#AAA]">{item.type}</td>
                  <td className="px-5 py-4 font-semibold text-white">{formatAmount(item.amount)} {paymentUnit(item)}</td>
                  <td className="px-5 py-4"><Status>{item.status}</Status></td>
                  <td className="px-5 py-4 text-sm text-white">{item.operatorName}</td>
                  <td className="px-5 py-4 text-xs text-[#777]">{item.date}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      <button title="View details" onClick={() => setSelectedTransaction(item)} className="rounded-lg p-2 text-[#666] hover:bg-[#222] hover:text-white"><Eye size={16} /></button>
                      {["CUSTOMER_PURCHASE", "CASH_PURCHASE", "CUSTOMIZED_PURCHASE"].includes(item.type) && item.status === "COMPLETED" && <button title="Print receipt" aria-label={`Print receipt ${item.id}`} onClick={() => showReceipt(item.id)} className="rounded-lg p-2 text-[#666] hover:bg-[#222] hover:text-white"><Printer size={16} /></button>}
                      {(item.type === "CUSTOMIZED_PURCHASE" || (item.type === "CUSTOMER_PURCHASE" && item.metadata?.shared_transfer_id)) && item.status === "COMPLETED" && (
                        <button title="Refund shared BP payment" disabled={refundingId === item.id} onClick={() => doRefund(item)} className="rounded-lg p-2 text-[#666] hover:bg-[#F5C400] hover:text-black disabled:opacity-50"><RotateCcw size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan="8" className="px-5 py-16 text-center text-sm text-[#666]">{dataLoading ? "Loading transactions…" : "No transactions found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <CustomerPaymentDisputes />
      {selectedTransaction && (
        <Modal title="Transaction details" onClose={() => setSelectedTransaction(null)}>
          <dl className="space-y-3 text-sm">
            {[
              ["Transaction ID", selectedTransaction.id],
              ["Customer", selectedTransaction.customer],
              ["Type", selectedTransaction.type],
              ["Payment method", paymentMethod(selectedTransaction, transactions)],
              ["Amount", `${formatAmount(selectedTransaction.amount)} ${paymentUnit(selectedTransaction)}`],
              ["Status", selectedTransaction.status],
              ["Card", selectedTransaction.card],
              ["Workstation", selectedTransaction.workstation],
              ["Operator", selectedTransaction.operatorName],
              ["Created", selectedTransaction.date],
            ].map(([label, value]) => <div className="flex justify-between gap-4 border-b border-[#242424] pb-2" key={label}><dt className="text-[#777]">{label}</dt><dd className="break-all text-right text-white">{value}</dd></div>)}
            {selectedTransaction.metadata && <div><dt className="text-[#777]">Metadata</dt><dd className="mt-1 break-all rounded-lg bg-[#080808] p-3 text-xs text-[#AAA]">{JSON.stringify(selectedTransaction.metadata, null, 2)}</dd></div>}
          </dl>
        </Modal>
      )}
    </div>
  )
}

export default Transactions
