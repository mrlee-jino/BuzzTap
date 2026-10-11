import { useState } from "react"
import { Clock3, Monitor, Plus, Search, Settings2, Wrench } from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, Field, Modal, PageHeader, Status, cardClass, inputClass } from "../components/BusinessUI"

function Workstations() {
  const {
    workstations,
    workstationSessions,
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

  const sessionAction = async (item, action) => {
    setBusyId(item.id)
    setNotice("")
    const result = await changeWorkstationSession(item.id, action)
    setNotice(result.success ? `Session ${action === "START" ? "started" : "ended"} for ${item.name}.` : result.error)
    setBusyId(null)
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
              <p className="mt-4 font-semibold text-[#F5C400]">{item.rate} BP/hour</p>
              {activeSession && <p className="mt-2 text-xs text-[#AAA]">Session started {new Date(activeSession.started_at).toLocaleString()}</p>}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[#242424] pt-4">
                {item.status === "ACTIVE" && <button disabled={busyId === item.id} onClick={() => sessionAction(item, "START")} className="rounded-lg bg-[#F5C400] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50"><Clock3 size={14} className="mr-1 inline" />Start Session</button>}
                {item.status === "IN_USE" && <button disabled={busyId === item.id || !activeSession} onClick={() => sessionAction(item, "END")} className="rounded-lg bg-[#F5C400] px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">End Session</button>}
                {item.status !== "IN_USE" && item.status !== "DISABLED" && item.status !== "MAINTENANCE" && <button onClick={() => change(item, "MAINTENANCE")} title="Set maintenance" className="rounded-lg bg-[#1d1d1d] p-2 text-[#AAA]"><Wrench size={15} /></button>}
                {item.status === "DISABLED" || item.status === "MAINTENANCE"
                  ? <button onClick={() => change(item, "ACTIVE")} className="rounded-lg bg-[#1d1d1d] px-3 py-2 text-xs text-white">Enable</button>
                  : item.status !== "IN_USE" && <button onClick={() => change(item, "DISABLED")} title="Disable workstation" className="rounded-lg bg-[#1d1d1d] p-2 text-red-400"><Settings2 size={15} /></button>}
              </div>
            </div>
          )
        }) : <div className={`${cardClass} text-center text-sm text-[#666]`}>{dataLoading ? "Loading workstations…" : "No workstations found."}</div>}
      </div>
      {modal && <Modal title="Add Workstation" onClose={() => setModal(false)}><form onSubmit={add} className="space-y-4">
        <Field label="Workstation ID"><input className={inputClass} name="id" required placeholder="WS-009" /></Field>
        <Field label="Name"><input className={inputClass} name="name" required placeholder="Gaming Station 09" /></Field>
        <Field label="Type"><input className={inputClass} name="type" required placeholder="Gaming PC" /></Field>
        <Field label="Location"><input className={inputClass} name="location" required placeholder="Station Area" /></Field>
        <Field label="Hourly Rate (BP)"><input className={inputClass} name="rate" type="number" min="0" required placeholder="50" /></Field>
        <Field label="Device"><input className={inputClass} name="device" required placeholder="Station Controller #009" /></Field>
        <Button type="submit">Add Workstation</Button>
      </form></Modal>}
    </div>
  )
}

export default Workstations
