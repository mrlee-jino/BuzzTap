import { useEffect, useState } from "react"
import { Clock3, Monitor, Plus, Search, Settings2, Wrench } from "lucide-react"
import { useBusiness } from "../businessContext"
import PaymentCustomer from "../components/PaymentCustomer"
import { Button, Field, Modal, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"
import { formatRemaining, sessionCustomerName, sessionRemaining } from "../lib/sessionTiming"

function Workstations() {
  const {
    workstations,
    workstationSessions,
    customers,
    addWorkstation,
    updateWorkstationStatus,
    changeWorkstationSession,
    dataLoading,
    dataError,
  } = useBusiness()
  const [query, setQuery] = useState("")
  const [modal, setModal] = useState(false)
  const [notice, setNotice] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [sessionStation, setSessionStation] = useState(null)
  const [endStation, setEndStation] = useState(null)
  const [endError, setEndError] = useState("")
  const [customerType, setCustomerType] = useState("REGISTERED")
  const [paymentMethod, setPaymentMethod] = useState("CASH")
  const [sessionError, setSessionError] = useState("")
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [now, setNow] = useState(() => Date.now())
  const hasActiveSessions = workstationSessions.some((session) => session.status === "ACTIVE")
  useEffect(() => {
    if (!hasActiveSessions) return
    const tick = () => setNow(Date.now())
    const timer = setInterval(tick, 1000)
    window.addEventListener("focus", tick)
    return () => { clearInterval(timer); window.removeEventListener("focus", tick) }
  }, [hasActiveSessions])

  const startSession = async (event) => {
    event.preventDefault()
    if (busyId) return
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setBusyId(sessionStation.id)
    setSessionError("")
    try {
      const result = await changeWorkstationSession(sessionStation.id, "START", {
        customerId: customerType === "REGISTERED" ? data.customerId : null,
        guestName: customerType === "GUEST" ? data.guestName.trim() : null,
        paymentMethod, amount: Number(data.amount), requestId,
      })
      if (result.success) {
        setNotice(`Session started for ${sessionStation.name}.`)
        setSessionStation(null)
      } else setSessionError(result.error)
    } catch { setSessionError("Session could not be started. Please try again.") }
    finally { setBusyId(null) }
  }
  const visible = workstations.filter((item) =>
    `${item.workstation_code || item.id} ${item.name} ${item.status}`.toLowerCase().includes(query.toLowerCase()),
  )

  const add = async (event) => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const ok = await addWorkstation({ ...data, rate: Number(data.rate) })
    setNotice(ok ? "Workstation added successfully." : "Workstation save failed.")
    if (ok) setModal(false)
  }

  const change = async (item, status) => {
    if ((status === "DISABLED" || status === "MAINTENANCE") && !window.confirm(`Change ${item.name} to ${status}?`)) return
    const ok = await updateWorkstationStatus(item.id, status)
    setNotice(ok ? `${item.name} updated.` : "Workstation update failed.")
  }

  const confirmEndSession = async () => {
    if (busyId || !endStation) return
    setBusyId(endStation.id)
    setNotice("")
    setEndError("")
    try {
      const result = await changeWorkstationSession(endStation.id, "END")
      if (result.success) {
        setNotice(`Session ended for ${endStation.name}.`)
        setEndStation(null)
      } else setEndError(result.error || "Session could not be ended. Please try again.")
    } catch { setEndError("Session could not be ended. Please try again.") }
    finally { setBusyId(null) }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title="Workstations" description="Monitor stations, devices, availability, and recorded customer sessions." action={<Button onClick={() => setModal(true)}><Plus size={17} />Add Workstation</Button>} />
      {(notice || dataError || dataLoading) && (
        <p role={dataError ? "alert" : "status"} className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#F5C400]/30 bg-[#F5C400]/10 text-[#F5C400]"}`}>
          {dataError ? `Database error: ${dataError}` : notice || "Loading workstation records…"}
        </p>
      )}
      <div className={`${cardClass} mb-6 flex items-center gap-3 p-4`}>
        <Search size={17} className="text-[#666]" />
        <input className={`${inputClass} border-0 p-0`} placeholder="Search station, ID, or status" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.length ? visible.map((item) => {
          const activeSession = workstationSessions.find((session) => session.workstation_id === item.id && session.status === "ACTIVE")
          return (
            <div className={cardClass} key={item.id}>
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C400]/10 text-[#F5C400]"><Monitor size={21} /></div>
                <Status>{item.status}</Status>
              </div>
              <p className="mt-6 text-xs text-[#666]">{item.workstation_code || item.id} · {item.type}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{item.name}</h2>
              <p className="mt-2 text-sm text-[#777]">{item.location} · {item.device}</p>
              <p className="mt-4 font-semibold text-[#F5C400]">{item.rate} cash/hour · {item.rate} BP or CBP/hour</p>
              {item.status === "IN_USE" && <div className="mt-4 rounded-xl border border-[#F5C400]/20 bg-[#F5C400]/5 p-3">
                <p className="text-xs text-[#AAA]">Customer</p>
                <p className="mt-1 font-semibold text-white">{sessionCustomerName(activeSession, customers)}</p>
                <p className="mt-3 text-xs text-[#AAA]">Remaining time</p>
                <p role="timer" aria-label="Remaining session time" className={`mt-1 font-mono text-xl font-semibold tabular-nums ${sessionRemaining(activeSession, now) === 0 ? "text-red-300" : "text-[#F5C400]"}`}>{formatRemaining(sessionRemaining(activeSession, now))}</p>
                {activeSession && <p className="mt-2 text-xs text-[#AAA]">Started {new Date(activeSession.started_at).toLocaleString()}</p>}
              </div>}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[#242424] pt-4">
                {item.status === "ACTIVE" && <button disabled={busyId === item.id} onClick={() => { setRequestId(crypto.randomUUID()); setSessionStation(item); setCustomerType("REGISTERED"); setPaymentMethod("CASH"); setSessionError("") }} className="rounded-lg bg-[#F5C400] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"><Clock3 size={14} className="mr-1 inline" />Start Session</button>}
                {item.status === "IN_USE" && <button disabled={Boolean(busyId) || !activeSession} onClick={() => { setEndStation(item); setEndError("") }} className="rounded-lg bg-[#F5C400] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">End Session</button>}
                {item.status !== "IN_USE" && item.status !== "DISABLED" && item.status !== "MAINTENANCE" && <button onClick={() => change(item, "MAINTENANCE")} title="Set maintenance" className="rounded-lg bg-[#1d1d1d] p-2 text-[#AAA]"><Wrench size={15} /></button>}
                {item.status === "DISABLED" || item.status === "MAINTENANCE"
                  ? <button onClick={() => change(item, "ACTIVE")} className="rounded-lg bg-[#1d1d1d] px-3 py-2 text-xs text-white">Enable</button>
                  : item.status !== "IN_USE" && <button onClick={() => change(item, "DISABLED")} title="Disable workstation" className="rounded-lg bg-[#1d1d1d] p-2 text-red-400"><Settings2 size={15} /></button>}
              </div>
            </div>
          )
        }) : <div className={`${cardClass} text-center text-sm text-[#666]`}>{dataLoading ? "Loading workstations…" : "No workstations found."}</div>}
      </div>
      {sessionStation && <Modal title={`Start Session · ${sessionStation.name}`} onClose={() => { if (!busyId) setSessionStation(null) }}><form onSubmit={startSession} className="space-y-4">
        <Field label="Payment method"><select className={inputClass} value={paymentMethod} disabled={Boolean(busyId)} onChange={(event) => { setPaymentMethod(event.target.value); setRequestId(crypto.randomUUID()) }}><option value="CASH">Cash</option>{customerType === "REGISTERED" && <><option value="BUZZPOINTS">BuzzPoints (shared BP)</option><option value="CUSTOMIZED">Customized BuzzPoints (this business)</option></>}</select></Field>
        <Field label="User Account"><select className={inputClass} value={customerType} disabled={Boolean(busyId)} onChange={(event) => { setRequestId(crypto.randomUUID()); setCustomerType(event.target.value); setPaymentMethod("CASH") }}><option value="REGISTERED">Registered customer</option><option value="GUEST">Non-registered customer</option></select></Field>
        {customerType === "REGISTERED" ? <PaymentCustomer key={paymentMethod} allowTap={paymentMethod !== "CASH"} linkedOnly={paymentMethod !== "CASH"} disabled={Boolean(busyId)} onChange={() => setRequestId(crypto.randomUUID())} /> : <Field label="Guest name"><input className={inputClass} name="guestName" onChange={() => setRequestId(crypto.randomUUID())} required maxLength={160} disabled={Boolean(busyId)} placeholder="Customer name" /></Field>}
        {customerType === "GUEST" && <p className="text-xs text-[#AAA]">BuzzPoints payments require a registered customer wallet.</p>}
        <p className="text-xs text-[#AAA]">Session time is calculated automatically from the amount paid at {sessionStation.rate} {paymentMethod === "CASH" ? "cash" : paymentMethod === "CUSTOMIZED" ? "CBP" : "BP"}/hour.</p>
        <Field label={`Amount purchased (${paymentMethod === "CASH" ? "cash" : paymentMethod === "CUSTOMIZED" ? "CBP" : "BP"})`}><input className={inputClass} name="amount" required type="number" min={paymentMethod !== "CASH" ? "1" : "0.01"} step={paymentMethod !== "CASH" ? "1" : "0.01"} onChange={() => setRequestId(crypto.randomUUID())} disabled={Boolean(busyId)} placeholder="Enter amount" /></Field>
        {sessionError && <p role="alert" className="text-sm text-red-300">{sessionError}</p>}
        <Button type="submit" disabled={Boolean(busyId)}>{busyId ? "Starting…" : "Confirm and Start Session"}</Button>
      </form></Modal>}
      {endStation && <Modal title={`End Session · ${endStation.name}`} onClose={() => { if (!busyId) setEndStation(null) }}>
        <div role="alertdialog" aria-modal="true" aria-label={`End session for ${endStation.name}`} aria-describedby="end-session-description" className="space-y-4">
          <p id="end-session-description" className="text-sm text-[#AAA]">Are you sure you want to end the session for <strong className="text-white">{endStation.name}</strong>? The workstation will become available.</p>
          {endError && <p role="alert" className="text-sm text-red-300">{endError}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" autoFocus disabled={Boolean(busyId)} onClick={() => setEndStation(null)} className="rounded-xl border border-[#333] bg-[#191919] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Cancel</button>
            <Button disabled={Boolean(busyId)} onClick={confirmEndSession}>{busyId ? "Ending…" : "Confirm End Session"}</Button>
          </div>
        </div>
      </Modal>}
      {modal && <Modal title="Add Workstation" onClose={() => setModal(false)}><form onSubmit={add} className="space-y-4">
        <Field label="Workstation ID"><input className={inputClass} name="id" required placeholder="WS-009" /></Field>
        <Field label="Name"><input className={inputClass} name="name" required placeholder="Gaming Station 09" /></Field>
        <Field label="Type"><input className={inputClass} name="type" required placeholder="Gaming PC" /></Field>
        <Field label="Location"><input className={inputClass} name="location" required placeholder="Station Area" /></Field>
        <Field label="Hourly Rate (cash or BP)"><input className={inputClass} name="rate" type="number" min="0.01" step="0.01" required placeholder="50" /></Field>
        <Field label="Device"><input className={inputClass} name="device" required placeholder="Station Controller #009" /></Field>
        <Button type="submit">Add Workstation</Button>
      </form></Modal>}
    </div>
  )
}

export default Workstations
