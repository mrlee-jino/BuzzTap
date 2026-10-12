import { useState } from "react"
import { CreditCard } from "lucide-react"
import { useBusiness } from "../businessContext"
import { supabase } from "../lib/supabaseClient"
import { nextCustomerCode } from "../lib/customerRegistration"
import { Button, Field, Modal, inputClass } from "./BusinessUI"

export default function CustomerRegistration({ onClose, onRegistered }) {
  const { business, customers, dataLoading, dataError, refreshBusinessData } = useBusiness()
  const [mode, setMode] = useState("ACCOUNT")
  const [account, setAccount] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cardCode, setCardCode] = useState("")
  const [lookingUp, setLookingUp] = useState(false)
  const customerCode = nextCustomerCode(customers)

  const changeMode = (value) => {
    setMode(value)
    setAccount(null)
    setName("")
    setEmail("")
    setError("")
  }

  const lookupCard = async () => {
    if (lookingUp || saving) return
    setLookingUp(true)
    setError("")
    setAccount(null)
    setName("")
    setEmail("")
    try {
      const result = await supabase.rpc("resolve_customer_card_account", { p_business_id: business.id, p_card_code: cardCode.trim() })
      if (result.error) throw result.error
      const found = result.data?.[0]
      if (!found) throw new Error("No customer was found for this card.")
      setAccount(found)
      setName(found.full_name || "")
      setEmail(found.email || "")
    } catch (failure) { setError(failure.message || "Card lookup failed.") }
    finally { setLookingUp(false) }
  }

  const register = async (event) => {
    event.preventDefault()
    if (saving || lookingUp || dataLoading || dataError || !customerCode || (mode === "NFC" && !account)) return
    setSaving(true)
    setError("")
    try {
      const result = await supabase.rpc("register_customer_with_card_code", {
        p_business_id: business.id, p_profile_id: mode === "NFC" ? account?.id || null : null,
        p_name: name.trim(), p_email: email.trim(),
        p_customer_code: nextCustomerCode(customers),
        p_card_code: mode === "NFC" ? cardCode.trim() : null,
      })
      if (result.error) throw result.error
      await refreshBusinessData()
      onRegistered()
    } catch (failure) { setError(failure.message || "Customer registration failed.") }
    finally { setSaving(false) }
  }

  return <Modal title="Register Customer" onClose={() => { if (!saving) onClose() }}>
    <form onSubmit={register} className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Registration method">
        <Button type="button" secondary={mode !== "ACCOUNT"} disabled={saving || lookingUp} onClick={() => changeMode("ACCOUNT")}>Create local account</Button>
        <Button type="button" secondary={mode !== "NFC"} disabled={saving || lookingUp} onClick={() => changeMode("NFC")}><CreditCard size={16} />By BuzzTap NFC Card</Button>
      </div>
      {mode === "NFC" && <Field label="BuzzTap NFC Card Code"><input className={inputClass} name="cardCode" required value={cardCode} disabled={saving || lookingUp} onChange={(event) => { setCardCode(event.target.value); setAccount(null); setName(""); setEmail("") }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); lookupCard() } }} placeholder="Type or scan the Admin-issued card code" /><p className="my-2 text-xs text-[#888]">Find the customer already linked by Admin. Their card assignment stays intact.</p><Button type="button" secondary disabled={saving || lookingUp || !cardCode.trim()} onClick={lookupCard}>{lookingUp ? "Looking up..." : "Find Customer"}</Button></Field>}
      {account && <p className="text-xs text-[#F5C400]">Linked account: {account.full_name || account.email} <button type="button" disabled={saving} onClick={() => { setAccount(null); setName(""); setEmail("") }} className="ml-2 underline">Clear</button></p>}
      <Field label="Full Name"><input className={inputClass} name="name" required value={name} readOnly={Boolean(account)} disabled={saving} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" required value={email} readOnly={Boolean(account)} disabled={saving} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Field label="Customer ID (automatic)"><input className={inputClass} name="customerCode" readOnly value={dataLoading ? "" : customerCode || ""} placeholder="Generated automatically" /><p className="mt-2 text-xs text-[#888]">Assigned when registered. The sequence starts at 001 each day.</p></Field>
      {!customerCode && <p role="alert" className="text-sm text-red-300">The daily limit of 999 customer IDs has been reached.</p>}
      {dataError && <p role="alert" className="text-sm text-red-300">Customer records could not be loaded: {dataError}</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <Button type="submit" disabled={saving || lookingUp || dataLoading || !!dataError || !customerCode || (mode === "NFC" && !account)}>{saving ? "Registering..." : "Register Customer"}</Button>
    </form>
  </Modal>
}
