import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { useBusiness } from "../businessContext"
import { Button, Status, cardClass } from "./BusinessUI"

export default function CustomerPaymentRequests({ kind }) {
  const { business, customers, businessRole, captureCustomerPayment, showReceipt } = useBusiness()
  const [requests, setRequests] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [hasMore, setHasMore] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const canCapture = kind === "PRODUCT" || ["OWNER", "MANAGER"].includes(businessRole)
  useEffect(() => {
    let stopped = false
    let running = false
    const load = async () => {
      if (running || document.hidden) return
      running = true
      try {
        const [result, recent] = await Promise.all([
          supabase.from("customer_payment_requests").select("id,customer_id,item_name,kind,payment_method,amount,quantity,duration_seconds,state,expires_at,created_at,transaction_id")
          .eq("business_id", business.id).eq("kind", kind).in("state", ["PENDING", "APPROVED"])
          .gt("expires_at", new Date().toISOString()).order("created_at").limit(pageSize + 1),
          supabase.from("customer_payment_requests").select("id,item_name,amount,payment_method,transaction_id,session_id,captured_at")
            .eq("business_id", business.id).eq("kind", kind).eq("state", "CAPTURED")
            .order("captured_at", { ascending: false }).limit(5),
        ])
        if (!stopped) {
          setNow(Date.now())
          if (result.error || recent.error) setLoadError("Payment requests unavailable. Contact your administrator to check payment setup.")
          else {
            setRequests((result.data || []).slice(0, pageSize)); setHasMore(result.data.length > pageSize)
            setRecentPayments(recent.data || []); setLoadError("")
          }
        }
      } catch { if (!stopped) setLoadError("Payment requests could not be refreshed. Try again.") }
      finally { running = false }
    }
    load()
    const timer = setInterval(load, 3000)
    window.addEventListener("focus", load)
    return () => { stopped = true; clearInterval(timer); window.removeEventListener("focus", load) }
  }, [business.id, kind, refresh, pageSize])

  const act = async (request, capture) => {
    if (busy) return
    setBusy(request.id); setError(""); setNotice("")
    try {
      const result = capture
        ? await captureCustomerPayment(request.id)
        : await supabase.rpc("cancel_customer_payment", { p_request_id: request.id })
      if (result.error || result.success === false) throw new Error(typeof result.error === "string" ? result.error : result.error?.message)
      setNotice(capture ? "Payment completed. The saved receipt is available." : "Payment request cancelled.")
    } catch (failure) { setError(failure.message || "The operation could not be confirmed. Refresh and retry the same request.") }
    finally { setBusy(null); setRefresh((value) => value + 1) }
  }
  return <section className={`${cardClass} mt-6`}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">Customer payment approvals</h2><Button secondary disabled={Boolean(busy)} onClick={() => setRefresh((value) => value + 1)}>Refresh</Button></div>
    <p className="mt-2 text-sm text-[#AAA]">Customers review and approve points payments in their BuzzTap app. Requests expire after five minutes. Complete an approved payment before issuing goods or starting a session. Completed payments are recorded in the business transaction history.</p>
    {(error || loadError) && <p role="alert" className="mt-3 text-sm text-red-300">{error || loadError}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-[#F5C400]">{notice}</p>}
    {!requests.length && !error && !loadError && <p className="mt-4 text-sm text-[#888]">No pending payment requests.</p>}
    <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto">{requests.map((request) => {
      const expired = new Date(request.expires_at).getTime() <= now && ["PENDING", "APPROVED"].includes(request.state)
      const actionable = !expired && ["PENDING", "APPROVED"].includes(request.state)
      return <div key={request.id} className="rounded-xl border border-[#333] p-4">
        <div className="flex justify-between gap-3"><p className="font-medium text-white">{customers.find((customer) => customer.id === request.customer_id)?.name || "Customer"}</p><Status>{expired ? "EXPIRED" : request.state}</Status></div>
        <p className="mt-2 text-sm text-[#AAA]">{request.item_name}{request.quantity ? ` × ${request.quantity}` : ` · ${Math.ceil(request.duration_seconds / 60)} minutes`} · {Number(request.amount).toLocaleString()} {request.payment_method === "CUSTOMIZED" ? "CBP at this business" : "shared BP"}</p>
        <p className="mt-2 break-all text-xs text-[#777]">Reference: {request.id}</p>
        {actionable && <p className="mt-1 text-xs text-[#888]">Expires {new Date(request.expires_at).toLocaleTimeString()}</p>}
        {actionable && <div className="mt-3 flex gap-3">
          {request.state === "APPROVED" && canCapture && <Button disabled={Boolean(busy)} onClick={() => act(request, true)}>{busy === request.id ? "Processing…" : "Complete payment"}</Button>}
          <Button secondary disabled={Boolean(busy)} onClick={() => act(request, false)}>Cancel request</Button>
        </div>}
      </div>
    })}</div>
    {hasMore && <div className="mt-4"><Button secondary onClick={() => setPageSize((size) => size + 50)}>Show more pending requests</Button></div>}
    {recentPayments.length > 0 && <div className="mt-5 border-t border-[#333] pt-4">
      <h3 className="text-sm font-semibold text-white">Recent completed payments</h3>
      <p className="mt-1 text-xs text-[#888]">Reopen the saved receipt if the payment response or printout was interrupted.</p>
      {recentPayments.map((request) => <div key={request.id} className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-[#AAA]">{request.item_name} · {Number(request.amount).toLocaleString()} {request.payment_method === "CUSTOMIZED" ? "CBP" : "BP"}<span className="mt-1 block text-xs text-[#777]">{new Date(request.captured_at).toLocaleString()}</span></p>
        <Button secondary onClick={() => showReceipt(request.session_id || request.transaction_id, request.session_id ? "SESSION" : "TRANSACTION")}>View receipt</Button>
      </div>)}
    </div>}
  </section>
}
