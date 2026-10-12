import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Printer, X } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { useBusiness } from "../businessContext"
import { formatAmount, paymentMethod } from "../lib/businessFinance"

export default function PurchaseReceipt({ request, onClose }) {
  const { business, customers, products, workstations, transactions } = useBusiness()
  const [record, setRecord] = useState(null)
  const [session, setSession] = useState(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const printed = useRef(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let id = request.id
        if (request.kind === "SESSION") {
          const result = await supabase.from("workstation_sessions").select("*").eq("business_id", business.id).eq("id", id).single()
          if (result.error) throw result.error
          id = result.data.transaction_id
          if (!cancelled) setSession(result.data)
        }
        let query = supabase.from("business_transactions").select("*").eq("business_id", business.id)
        query = request.kind === "TRANSFER" ? query.eq("metadata->>shared_transfer_id", id) : query.eq("id", id)
        const result = await query.single()
        if (result.error) throw result.error
        if (!cancelled) { setRecord(result.data); setError("") }
      } catch (failure) { if (!cancelled) setError(failure.message || "Receipt details could not be loaded.") }
    }
    load()
    return () => { cancelled = true }
  }, [request.id, request.kind, business.id, retry])
  useEffect(() => {
    if (!record || !request.autoPrint || printed.current) return
    const timer = setTimeout(() => { printed.current = true; window.print() }, 300)
    return () => clearTimeout(timer)
  }, [record, request.autoPrint])
  const metadata = record?.metadata || {}
  const cash = record && paymentMethod(record, transactions) === "CASH"
  const unit = cash ? "cash" : "BP"
  const customer = customers.find((item) => item.id === record?.customer_id)
  const product = products.find((item) => item.id === metadata.product_id)
  const station = workstations.find((item) => item.id === record?.workstation_id)
  const operator = transactions.find((item) => item.id === record?.id)?.operatorName
  return createPortal(<div className="purchase-receipt-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Purchase receipt">
    <div className="purchase-receipt-container max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 text-black shadow-2xl">
      <div className="receipt-controls mb-4 flex items-center justify-between"><h2 className="font-semibold">Purchase receipt</h2><button type="button" onClick={onClose} aria-label="Close receipt"><X size={20} /></button></div>
      {error ? <div className="receipt-controls"><p role="alert" className="text-sm text-red-700">Payment succeeded. Receipt could not be loaded: {error}</p><button type="button" onClick={() => { setError(""); setRetry((value) => value + 1) }} className="mt-3 rounded bg-[#F5C400] px-4 py-2">Retry receipt</button></div> : !record ? <p role="status">Loading saved receipt...</p> : <article className="purchase-receipt font-mono text-xs leading-6">
        <header className="text-center"><h3 className="text-lg font-bold">{business.name}</h3>{business.address && <p>{business.address}</p>}{business.phone && <p>{business.phone}</p>}<p className="mt-3 font-bold">SALES RECEIPT</p></header>
        <div className="my-4 border-y border-dashed border-gray-400 py-3"><p className="break-all">Reference: {record.id}</p><p>{new Date(record.created_at).toLocaleString()}</p><p>Customer: {customer?.name || metadata.guest_name || session?.customer_name || "Local customer"}</p><p>Payment: {cash ? "Cash" : "BuzzPoints"}</p>{operator && <p>Operator: {operator}</p>}</div>
        <div className="flex justify-between gap-4"><span>{product?.name || metadata.product_id || station?.name || "Workstation session"}{metadata.quantity ? ` × ${metadata.quantity}` : ""}</span><span className="shrink-0">{formatAmount(record.amount)} {unit}</span></div>
        {session?.duration_seconds && <p>Purchased time: {formatAmount(session.duration_seconds / 60)} minutes</p>}
        <div className="mt-4 space-y-1 border-t border-dashed border-gray-400 pt-3"><p className="flex justify-between font-bold"><span>TOTAL</span><span>{formatAmount(record.amount)} {unit}</span></p>{cash && metadata.cash_received != null && <><p className="flex justify-between"><span>Cash received</span><span>{formatAmount(metadata.cash_received)} cash</span></p><p className="flex justify-between"><span>Change due</span><span>{formatAmount(metadata.change_due)} cash</span></p></>}</div>
        <p className="mt-6 text-center">Thank you for your purchase!</p><p className="text-center text-[10px]">Recorded with BuzzTap</p>
      </article>}
      <div className="receipt-controls mt-5 flex gap-3"><button type="button" disabled={!record || !!error} onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-[#F5C400] px-4 py-3 text-sm font-semibold disabled:opacity-50"><Printer size={17} />Print receipt</button><button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-3 text-sm">Done</button></div>
    </div>
  </div>, document.body)
}
