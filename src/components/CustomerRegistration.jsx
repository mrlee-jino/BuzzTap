import { useEffect, useState } from "react"
import { CreditCard } from "lucide-react"
import { useBusiness } from "../businessContext"
import { supabase } from "../lib/supabaseClient"
import { Button, Field, Modal, inputClass } from "./BusinessUI"

export default function CustomerRegistration({ onClose, onRegistered }) {
  const { business, refreshBusinessData } = useBusiness()
  const [mode, setMode] = useState("ACCOUNT")
  const [search, setSearch] = useState("")
  const [accounts, setAccounts] = useState([])
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cardCode, setCardCode] = useState("")
  const [lookingUp, setLookingUp] = useState(false)

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

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      if (search.trim().length < 3 || !business?.id) { setAccounts([]); setLoading(false); return }
      setLoading(true)
      setError("")
      try {
        const result = await supabase.rpc("search_customer_accounts", { p_business_id: business.id, p_search: search.trim() })
        if (cancelled) return
        if (result.error) throw result.error
        setAccounts(result.data || [])
      } catch (failure) {
        if (!cancelled) { setAccounts([]); setError(failure.message || "Customer accounts could not be loaded.") }
      } finally { if (!cancelled) setLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [business?.id, search])

  const register = async (event) => {
    event.preventDefault()
    if (saving) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError("")
    try {
      const result = await supabase.rpc("register_customer_with_card_code", {
        p_business_id: business.id, p_profile_id: account?.id || null,
        p_name: name.trim(), p_email: email.trim(),
        p_customer_code: String(form.get("customerCode") || "").trim() || null,
        p_card_code: mode === "NFC" ? String(form.get("cardCode") || "").trim() : null,
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
        <Button type="button" secondary={mode !== "ACCOUNT"} disabled={saving || lookingUp} onClick={() => { setMode("ACCOUNT"); setAccount(null); setName(""); setEmail(""); setError("") }}>By account</Button>
        <Button type="button" secondary={mode !== "NFC"} disabled={saving || lookingUp} onClick={() => { setMode("NFC"); setAccount(null); setName(""); setEmail(""); setSearch(""); setAccounts([]); setError("") }}><CreditCard size={16} />By BuzzTap NFC Card</Button>
      </div>
      {mode === "NFC" && <Field label="BuzzTap NFC Card Code"><input className={inputClass} name="cardCode" required value={cardCode} disabled={saving || lookingUp} onChange={(event) => { setCardCode(event.target.value); setAccount(null); setName(""); setEmail("") }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); lookupCard() } }} placeholder="Type or scan the Admin-issued card code" /><p className="my-2 text-xs text-[#888]">Find the customer already linked by Admin. Their card assignment stays intact.</p><Button type="button" secondary disabled={saving || lookingUp || !cardCode.trim()} onClick={lookupCard}>{lookingUp ? "Looking up…" : "Find Customer"}</Button></Field>}
      {mode === "ACCOUNT" && <Field label="Existing Customer account (optional)"><input className={inputClass} value={search} disabled={saving} onChange={(event) => { setSearch(event.target.value); setAccounts([]) }} placeholder="Search customer name or email (3+ characters)" /></Field>}
      {loading && <p role="status" className="text-xs text-[#AAA]">Searching customer accounts…</p>}
      {!loading && search.trim().length >= 3 && !accounts.length && !error && <p className="text-xs text-[#AAA]">No matching active Customer accounts.</p>}
      {accounts.length > 0 && <div className="max-h-36 overflow-auto rounded-lg border border-[#292929]">{accounts.map((item) => <button key={item.id} type="button" disabled={saving} className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-[#222]" onClick={() => { setAccount(item); setName(item.full_name || ""); setEmail(item.email || ""); setSearch(""); setAccounts([]) }}>{item.full_name || "Customer"} · {item.email}</button>)}</div>}
      {account && <p className="text-xs text-[#F5C400]">Linked account: {account.full_name || account.email} <button type="button" disabled={saving} onClick={() => { setAccount(null); setName(""); setEmail("") }} className="ml-2 underline">Clear</button></p>}
      <Field label="Full Name"><input className={inputClass} name="name" required value={name} readOnly={Boolean(account)} disabled={saving} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Email"><input className={inputClass} name="email" type="email" required value={email} readOnly={Boolean(account)} disabled={saving} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Field label="Customer ID (optional)"><input className={inputClass} name="customerCode" disabled={saving} placeholder="Generated automatically if left blank" /></Field>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <Button type="submit" disabled={saving || lookingUp || (mode === "NFC" && !account)}>{saving ? "Registering…" : "Register Customer"}</Button>
    </form>
  </Modal>
}
