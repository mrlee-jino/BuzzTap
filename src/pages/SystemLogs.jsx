import { useEffect, useState } from "react"
import { RefreshCw, Search } from "lucide-react"
import { useBusiness } from "../businessContext"
import { supabase } from "../lib/supabaseClient"
import { Button, PageHeader, inputClass, cardClass } from "../components/BusinessUI"

const categories = ["ALL", "ACCESS", "INVENTORY", "CATALOG", "CUSTOMERS", "WORKSTATIONS", "CONTENT", "TEAM", "BUSINESS", "FINANCE"]
export default function SystemLogs() {
  const { business } = useBusiness()
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("ALL")
  const [day, setDay] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [limit, setLimit] = useState(100)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        let request = supabase.from("business_system_logs").select("*").eq("business_id",business.id).order("occurred_at",{ ascending:false }).order("id",{ ascending:false }).limit(limit)
        if (category !== "ALL") request=request.eq("category",category)
        if (day) {
          const start=new Date(`${day}T00:00:00+08:00`)
          request=request.gte("occurred_at",start.toISOString()).lt("occurred_at",new Date(start.getTime()+86400000).toISOString())
        }
        const { data,error:failure }=await request
        if (failure) throw failure
        if (!cancelled) setRows(data || [])
      } catch (failure) { if (!cancelled) { setRows([]); setError(failure.message || "Logs could not be loaded.") } }
      finally { if (!cancelled) setLoading(false) }
    }
    if (business?.id) load()
    return () => { cancelled=true }
  },[business?.id,category,day,limit,refresh])
  const visible=rows.filter((item) => `${item.action} ${item.category} ${item.actor_name} ${item.source_table} ${item.source_id} ${JSON.stringify(item.details)}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="mx-auto max-w-[1700px]">
    <PageHeader title="System Logs" description="Business activity, stock changes, member access, and changes to your records." action={<Button secondary disabled={loading} onClick={() => setRefresh((value)=>value+1)}><RefreshCw size={16} />Refresh</Button>} />
    <div className={`${cardClass} mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]`}><label className="flex items-center gap-2"><Search size={17} /><input className={inputClass} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search loaded logs, operator, product, or record" aria-label="Search logs" /></label><select aria-label="Log category" className={inputClass} value={category} onChange={(event)=>{setCategory(event.target.value);setLimit(100)}}>{categories.map((value)=><option key={value} value={value}>{value === "ALL" ? "All activity" : value}</option>)}</select><input className={inputClass} type="date" aria-label="Activity date (UTC+8)" value={day} onChange={(event)=>{setDay(event.target.value);setLimit(100)}} /></div>
    {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
    <div className={`${cardClass} overflow-x-auto`}><table className="w-full min-w-[950px] text-left text-sm"><thead className="border-b border-[#333] text-xs text-[#888]"><tr>{["Date (UTC+8)","Member / operator","Category","Activity","Record","Details"].map((label)=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map((item)=><tr key={item.id} className="border-b border-[#222] text-[#AAA]"><td className="p-3">{new Date(item.occurred_at).toLocaleString(undefined,{timeZone:"Asia/Shanghai"})}</td><td className="p-3 text-white">{item.actor_name}</td><td className="p-3">{item.category}</td><td className="p-3 text-[#F5C400]">{item.action}</td><td className="max-w-56 break-words p-3">{item.source_table}<br />{item.source_id}</td><td className="p-3"><details><summary className="cursor-pointer">View changes</summary><pre className="mt-2 max-w-96 whitespace-pre-wrap break-all text-xs">{JSON.stringify(item.details,null,2)}</pre></details></td></tr>)}</tbody></table>{!visible.length && <p role="status" className="p-6 text-sm text-[#888]">{loading ? "Loading activity..." : "No matching activity recorded."}</p>}</div>
    <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-[#888]">Searching {rows.length} loaded records. Older stock and login/logout history is included; other changes are recorded after logging is enabled.</p>{rows.length === limit && <Button secondary disabled={loading} onClick={()=>setLimit((value)=>value+100)}>Load older logs</Button>}</div>
  </div>
}
