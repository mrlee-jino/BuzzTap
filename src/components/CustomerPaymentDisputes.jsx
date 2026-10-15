import { useEffect, useState } from "react"
import { useBusiness } from "../businessContext"
import { supabase } from "../lib/supabaseClient"
import { Button, Status, cardClass } from "./BusinessUI"

export default function CustomerPaymentDisputes() {
  const { business, businessRole, customers } = useBusiness()
  const [disputes, setDisputes] = useState([])
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const canReview = ["OWNER", "MANAGER"].includes(businessRole)
  useEffect(() => {
    if (!canReview) return
    let stopped = false
    const load = async () => {
      try {
        const { data, error: failure } = await supabase.from("customer_payment_disputes")
          .select("id,request_id,profile_id,reason,state,resolution,created_at")
          .eq("business_id", business.id).order("created_at", { ascending: false }).limit(50)
        if (failure) throw failure
        if (!stopped) { setDisputes(data || []); setError("") }
      } catch { if (!stopped) setError("Customer payment reports could not be loaded. Contact your administrator to check payment setup.") }
    }
    load()
    const timer = setInterval(load, 15000)
    return () => { stopped = true; clearInterval(timer) }
  }, [business.id, canReview, refresh])
  if (!canReview) return null
  return <section className={`${cardClass} mt-6`}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">Customer payment reports</h2><Button secondary onClick={() => setRefresh((value) => value + 1)}>Refresh</Button></div>
    <p className="mt-2 text-sm text-[#AAA]">Investigate charges reported through the customer app. Use the original transaction to issue a verified refund when appropriate. BuzzTap support records the final review outcome.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {!disputes.length && !error && <p className="mt-4 text-sm text-[#888]">No customer payment reports.</p>}
    {disputes.map((dispute) => <div key={dispute.id} className="mt-4 rounded-xl border border-[#333] p-4">
      <div className="flex justify-between gap-3"><p className="font-medium text-white">{customers.find((customer) => customer.profile_id === dispute.profile_id)?.name || "Customer"}</p><Status>{dispute.state}</Status></div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-[#AAA]">{dispute.reason}</p>
      <p className="mt-2 break-all text-xs text-[#888]">Payment reference: {dispute.request_id}</p>
      {dispute.resolution && <p className="mt-2 whitespace-pre-wrap text-sm text-[#AAA]">Review outcome: {dispute.resolution}</p>}
    </div>)}
    {disputes.length === 50 && <p className="mt-3 text-xs text-[#888]">Showing the 50 most recent reports. Contact BuzzTap support for older reports.</p>}
  </section>
}
