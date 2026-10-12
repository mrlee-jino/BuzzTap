import test from "node:test"
import assert from "node:assert/strict"
import { financialAudit, summarizeFinance, paymentMethod } from "./businessFinance.js"

const sale = (id, type, amount, metadata = {}, status = "COMPLETED") => ({ id, type, amount, metadata, status, created_at: "2026-10-12T15:30:00Z" })

test("cash and BP totals exclude loads and pending sales and subtract refunds in their payment units", () => {
  const audit = financialAudit([
    sale("cash", "CASH_PURCHASE", 49.5, { guest_name: "Local customer" }),
    sale("bp", "CUSTOMER_PURCHASE", 100), sale("load", "CUSTOMER_LOAD", 200),
    sale("pending", "CASH_PURCHASE", 50, {}, "PENDING"),
    sale("refund-bp", "REFUND", 25, { original_transaction_id: "bp" }),
    sale("refund-cash", "REFUND", 10, { original_transaction_id: "cash" }),
  ])
  assert.deepEqual(summarizeFinance(audit), {
    cashSales: 49.5, bpSales: 100, cashRefunds: 10, bpRefunds: 25,
    cashNet: 39.5, bpNet: 75, salesCount: 2, cashCount: 1, bpCount: 1,
  })
  assert.equal(audit.find((item) => item.id === "cash").unit, "cash")
  assert.equal(audit.find((item) => item.id === "refund-cash").unit, "cash")
})

test("transaction and legacy workstation ledger mirrors count once", () => {
  const audit = financialAudit([
    sale("transaction", "CUSTOMER_PURCHASE", 25, { session_id: "session" }),
    sale("shared", "CUSTOMER_PURCHASE", 10, { shared_transfer_id: "transfer" }),
  ], [
    { ...sale("ledger-session", "CUSTOMER_PURCHASE", 25), reference: "session" },
    { ...sale("ledger-transaction", "CUSTOMER_PURCHASE", 25), reference: "transaction" },
    { ...sale("ledger-transfer", "CUSTOMER_PURCHASE", 10), reference: "transfer" },
    sale("legacy", "CUSTOMER_PURCHASE", 7), sale("business-purchase", "PURCHASE", 500),
  ])
  assert.equal(summarizeFinance(audit).bpSales, 42)
  assert.equal(summarizeFinance(audit).salesCount, 3)
})

test("cash refunds retain their unit when the original sale is outside a report period", () => {
  const records = [sale("old-cash", "CUSTOMER_PURCHASE", 20, { payment_method: "CASH" }, "REFUNDED"),
    sale("refund", "REFUND", 20, { original_transaction_id: "old-cash" })]
  assert.equal(paymentMethod(records[1], records), "CASH")
  const audit = financialAudit(records)
  assert.equal(summarizeFinance(audit).cashSales, 20)
  assert.equal(summarizeFinance(audit).cashNet, 0)
  assert.equal(summarizeFinance(audit.filter((item) => item.id === "refund")).cashNet, -20)
})

test("cash cents are summed without floating point drift", () => {
  assert.equal(summarizeFinance(financialAudit([sale("one", "CASH_PURCHASE", 0.1), sale("two", "CASH_PURCHASE", 0.2)])).cashNet, 0.3)
})
