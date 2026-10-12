export const isCompleted = (item) => String(item.status || "").toUpperCase() === "COMPLETED"

export function paymentMethod(item, transactions = []) {
  if (item.type === "CASH_PURCHASE" || item.type === "CASH_REFUND" || item.metadata?.payment_method === "CASH") return "CASH"
  if (item.type === "REFUND" && item.metadata?.original_transaction_id) {
    const original = transactions.find((entry) => entry.id === item.metadata.original_transaction_id)
    if (original) return paymentMethod(original)
  }
  return "BUZZPOINTS"
}

export const paymentUnit = (item) => paymentMethod(item) === "CASH" ? "cash" : "BP"
export const formatAmount = (amount) => Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
export const isSale = (item) => ["CUSTOMER_PURCHASE", "CASH_PURCHASE"].includes(item.type)
export const isRefund = (item) => ["REFUND", "CASH_REFUND"].includes(item.type)

// The business transaction is authoritative when its wallet ledger entry
// references the same transaction, session or shared transfer.
export function financialAudit(transactions, ledger = []) {
  const references = new Set(transactions.flatMap((item) => [
    item.id, item.metadata?.session_id, item.metadata?.shared_transfer_id,
    item.metadata?.ledger_id, item.metadata?.wallet_ledger_id,
  ]).filter(Boolean))
  const entries = [
    ...transactions.map((item) => ({ ...item, source: "TRANSACTION" })),
    ...ledger.filter((item) => !references.has(item.id) && !(item.reference && references.has(item.reference)))
      .map((item) => ({ ...item, source: "WALLET_LEDGER" })),
  ]
  return entries.map((item) => {
    const method = paymentMethod(item, transactions)
    return { ...item, paymentMethod: method, unit: method === "CASH" ? "cash" : "BP" }
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function summarizeFinance(entries) {
  const summary = { cashSales: 0, bpSales: 0, cashRefunds: 0, bpRefunds: 0, cashNet: 0, bpNet: 0, salesCount: 0, cashCount: 0, bpCount: 0 }
  for (const item of entries) {
    if (!isCompleted(item) && !(isSale(item) && item.status === "REFUNDED")) continue
    const method = item.paymentMethod || paymentMethod(item, entries)
    const amount = Math.round(Number(item.amount || 0) * 100)
    if (isSale(item)) {
      summary[method === "CASH" ? "cashSales" : "bpSales"] += amount
      summary[method === "CASH" ? "cashCount" : "bpCount"] += 1
      summary.salesCount += 1
    } else if (isRefund(item)) {
      summary[method === "CASH" ? "cashRefunds" : "bpRefunds"] += amount
    }
  }
  for (const key of ["cashSales", "bpSales", "cashRefunds", "bpRefunds"]) summary[key] /= 100
  summary.cashNet = Math.round((summary.cashSales - summary.cashRefunds) * 100) / 100
  summary.bpNet = Math.round((summary.bpSales - summary.bpRefunds) * 100) / 100
  return summary
}
