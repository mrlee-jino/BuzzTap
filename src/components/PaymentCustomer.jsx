import { useEffect, useRef, useState } from "react"
import { CreditCard } from "lucide-react"
import { useBusiness } from "../businessContext"
import { supabase } from "../lib/supabaseClient"
import { Button, Field, inputClass } from "./BusinessUI"

export default function PaymentCustomer({ disabled = false, allowTap = true, linkedOnly = true, onChange }) {
  const { business, customers } = useBusiness()
  const [mode, setMode] = useState("MANUAL")
  const [code, setCode] = useState("")
  const [selected, setSelected] = useState("")
  const [lookingUp, setLookingUp] = useState(false)
  const [error, setError] = useState("")
  const token = useRef(0)
  const eligible = customers.filter((item) => item.status === "ACTIVE" && (!linkedOnly || (item.profile_id && item.profileStatus === "ACTIVE")))
  const customer = eligible.find((item) => item.id === selected)
  useEffect(() => () => { token.current += 1 }, [])
  const reset = () => { token.current += 1; setSelected(""); setError(""); setLookingUp(false); onChange?.() }
  const lookup = async () => {
    if (disabled || lookingUp || !code.trim()) return
    const request = ++token.current
    setSelected(""); setError(""); setLookingUp(true); onChange?.()
    try {
      const { data, error: failure } = await supabase.rpc("resolve_customer_card_account", { p_business_id: business.id, p_card_code: code.trim() })
      if (token.current !== request) return
      if (failure) throw failure
      const account = data?.[0]
      const found = eligible.find((item) => item.profile_id === account?.id)
      if (!found) throw new Error("This card's account must be registered and active in your business. Register it on the Customers page first.")
      setSelected(found.id)
      onChange?.()
    } catch (failure) { if (token.current === request) setError(failure.message || "Card lookup failed. Tap again.") }
    finally { if (token.current === request) setLookingUp(false) }
  }
  return <div className="space-y-3">
    {allowTap && <div className="grid grid-cols-2 gap-2" role="group" aria-label="Customer identification method">
      <Button secondary={mode !== "MANUAL"} disabled={disabled} onClick={() => { reset(); setMode("MANUAL") }}>Select account</Button>
      <Button secondary={mode !== "TAP"} disabled={disabled} onClick={() => { reset(); setMode("TAP") }}><CreditCard size={16} />TapToPay</Button>
    </div>}
    {mode === "TAP" && allowTap && <>
      <Field label="Tap NFC card"><input autoFocus className={inputClass} value={code} disabled={disabled} autoComplete="off" maxLength={160} onChange={(event) => { reset(); setCode(event.target.value) }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); lookup() } }} placeholder="Tap on the reader or enter the card code" /></Field>
      <p className="text-xs leading-5 text-[#AAA]">Click the card field, then tap a card on a reader that types the card code. Enter finds the linked account. Review the customer before confirming payment.</p>
      <Button secondary disabled={disabled || lookingUp || !code.trim()} onClick={lookup}>{lookingUp ? "Finding account..." : "Find linked account"}</Button>
    </>}
    <Field label={mode === "TAP" && allowTap ? "Linked customer account" : "Customer"}>
      <select className={inputClass} name="customerId" required value={customer?.id || ""} disabled={disabled} onChange={(event) => { setSelected(event.target.value); onChange?.() }}>
        <option value="" disabled>{mode === "TAP" && allowTap ? "Tap a registered card to find the account" : "Select customer"}</option>
        {(mode === "TAP" && allowTap ? customer ? [customer] : [] : eligible).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email} · {item.wallet == null ? "Wallet unavailable" : `${item.wallet} BP`}</option>)}
      </select>
    </Field>
    {mode === "TAP" && customer && <p role="status" className="rounded-lg border border-[#F5C400]/30 bg-[#F5C400]/5 p-3 text-sm text-[#F5C400]">{customer.name} · {customer.email}<br />Available: {customer.wallet ?? 0} BP. Confirm below to pay.</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>
}
