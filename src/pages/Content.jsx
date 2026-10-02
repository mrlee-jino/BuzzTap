import { useMemo, useState } from "react"
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileImage,
  LoaderCircle,
  Megaphone,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, Field, PageHeader, cardClass, inputClass } from "../components/BusinessUI"

const filters = [
  { value: "ALL", label: "All content" },
  { value: "PUBLISHED", label: "Published" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "DRAFT", label: "Drafts" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
]

const today = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function safeMediaUrl(value) {
  if (!value) return ""
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) ? url.href : ""
  } catch {
    return ""
  }
}

function contentStatus(item) {
  const status = String(item.status || "DRAFT").toUpperCase()
  if (status === "ARCHIVED") return status
  if (status === "PUBLISHED" && item.endDate && item.endDate < today()) return "EXPIRED"
  if (["SUBMITTED", "PENDING", "PENDING_REVIEW"].includes(status)) return "PENDING_REVIEW"
  return status
}

function statusLabel(status) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return "No end date"
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function statusStyle(status) {
  if (status === "PUBLISHED") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
  if (status === "PENDING_REVIEW") return "border-amber-400/20 bg-amber-400/10 text-amber-300"
  if (status === "REJECTED") return "border-red-400/20 bg-red-400/10 text-red-300"
  if (status === "EXPIRED" || status === "ARCHIVED") return "border-[#444] bg-[#222] text-[#999]"
  return "border-[#F5C400]/20 bg-[#F5C400]/10 text-[#F5C400]"
}

function StatusBadge({ status }) {
  return <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(status)}`}>{statusLabel(status)}</span>
}

function ActionButton({ children, onClick, disabled, accent = false, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${accent ? "bg-[#F5C400] text-black hover:bg-[#FFD83D]" : "bg-[#1d1d1d] text-[#ccc] hover:bg-[#292929] hover:text-white"}`}
    >
      {children}
    </button>
  )
}

function Content() {
  const { activities = [], dataLoading, dataError, addActivity, business } = useBusiness()
  const [filter, setFilter] = useState("ALL")
  const [query, setQuery] = useState("")
  const [editor, setEditor] = useState(null)
  const [preview, setPreview] = useState(null)
  const [notice, setNotice] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const items = useMemo(
    () => activities.map((item) => ({ ...item, viewStatus: contentStatus(item) })),
    [activities],
  )
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesStatus = filter === "ALL" || item.viewStatus === filter
      const matchesSearch = !search || `${item.title} ${item.type} ${item.description}`.toLowerCase().includes(search)
      return matchesStatus && matchesSearch
    })
  }, [items, filter, query])
  const counts = [
    { label: "Published", status: "PUBLISHED", icon: CheckCircle2, count: items.filter((item) => item.viewStatus === "PUBLISHED").length },
    { label: "Pending Review", status: "PENDING_REVIEW", icon: Clock3, count: items.filter((item) => item.viewStatus === "PENDING_REVIEW").length },
    { label: "Drafts", status: "DRAFT", icon: FileImage, count: items.filter((item) => item.viewStatus === "DRAFT").length },
    { label: "Expired", status: "EXPIRED", icon: CalendarDays, count: items.filter((item) => item.viewStatus === "EXPIRED").length },
  ]
  const feedItems = items.filter((item) => item.viewStatus === "PUBLISHED").slice(0, 3)

  const openEditor = (item = null) => {
    setNotice("")
    setEditor(item || {
      type: "UPDATE",
      title: "",
      description: "",
      startDate: today(),
      endDate: "",
      mediaUrl: "",
      callToAction: "",
    })
  }

  const save = async (event, submit = false) => {
    event.preventDefault()
    if (saving) return
    const formElement = event.currentTarget instanceof HTMLFormElement
      ? event.currentTarget
      : event.currentTarget.closest("form")
    if (!formElement) return
    const form = new FormData(formElement)
    const title = String(form.get("title") || "").trim()
    const description = String(form.get("description") || "").trim()
    const startDate = String(form.get("startDate") || "")
    const endDate = String(form.get("endDate") || "")
    const mediaUrl = String(form.get("mediaUrl") || "").trim()
    const callToAction = String(form.get("callToAction") || "").trim()

    if (!title || !description || !startDate || (endDate && endDate < startDate)) {
      setNotice("Add a title, post content, and valid dates. The end date must be on or after the start date.")
      return
    }
    if (mediaUrl && !safeMediaUrl(mediaUrl)) {
      setNotice("Enter a valid media URL using https:// or http://.")
      return
    }
    if (!business?.id) {
      setNotice("No active business membership is available. Sign in with an active business account and try again.")
      return
    }

    setSaving(true)
    setNotice("")
    const result = await addActivity({
      ...editor,
      type: String(form.get("type") || "UPDATE"),
      title,
      description,
      startDate,
      endDate,
      mediaUrl,
      callToAction,
      status: submit ? "SUBMITTED" : "DRAFT",
      contentId: editor.contentId || crypto.randomUUID(),
    })
    setSaving(false)
    if (!result?.success) {
      setNotice(result?.error || "Content could not be saved. Please try again.")
      return
    }
    setNotice(submit ? "Content submitted for admin review." : "Draft saved.")
    setEditor(null)
  }

  const duplicate = async (item) => {
    setBusyId(item.id)
    setNotice("")
    const result = await addActivity({
      ...item,
      id: undefined,
      contentId: crypto.randomUUID(),
      title: `${item.title} (Copy)`,
      status: "DRAFT",
    })
    setBusyId(null)
    setNotice(result?.success ? "Content duplicated as a draft." : result?.error || "Content could not be duplicated.")
  }

  const updateStatus = async (item, status) => {
    setBusyId(item.id)
    setNotice("")
    const result = await addActivity({ ...item, status })
    setBusyId(null)
    setNotice(result?.success ? `Content ${status === "SUBMITTED" ? "submitted for admin review" : "archived"}.` : result?.error || "Content status could not be updated.")
  }

  const editorCanSubmit = !editor?.id || ["DRAFT", "REJECTED"].includes(String(editor.status).toUpperCase())
  const editable = (item) => ["DRAFT", "REJECTED", "SUBMITTED", "PENDING", "PENDING_REVIEW"].includes(String(item.status).toUpperCase())

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow="MOBILE APP CONTENT"
        title="Business Content"
        description="Create and manage customer-facing content. Admin Web reviews and publishes submissions."
        action={<Button onClick={() => openEditor()}><Plus size={17} />Create Content</Button>}
      />

      {(notice || dataError) && (
        <div role="status" className={`mb-5 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#F5C400]/30 bg-[#F5C400]/10 text-[#F5C400]"}`}>
          {dataError ? `Database error: ${dataError}` : notice}
        </div>
      )}

      <section aria-label="Content totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {counts.map(({ label, status, icon: Icon, count }) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(filter === status ? "ALL" : status)}
            className={`${cardClass} p-4 text-left transition hover:border-[#F5C400]/40 sm:p-5 ${filter === status ? "border-[#F5C400]/60" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[#888] sm:text-sm">{label}</p>
              <Icon size={17} className={filter === status ? "text-[#F5C400]" : "text-[#666]"} />
            </div>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">{dataLoading ? "—" : count}</p>
          </button>
        ))}
      </section>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#222] bg-[#111] p-3 sm:flex-row sm:p-4">
        <label className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search title, type, or post content"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search business content"
          />
        </label>
        <select className={`${inputClass} sm:w-52`} value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter content by status">
          {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Business content list" className="space-y-4">
          {dataLoading ? (
            <div className={`${cardClass} flex items-center justify-center gap-3 py-14 text-sm text-[#999]`}><LoaderCircle size={18} className="animate-spin text-[#F5C400]" />Loading your business content…</div>
          ) : dataError && items.length === 0 ? (
            <div className={`${cardClass} px-5 py-12 text-center`}>
              <h2 className="font-semibold text-white">Content could not be loaded</h2>
              <p className="mt-2 text-sm text-[#999]">{dataError}</p>
            </div>
          ) : visible.length === 0 ? (
            <div className={`${cardClass} px-5 py-14 text-center`}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5C400]/10 text-[#F5C400]"><Megaphone size={21} /></div>
              <h2 className="mt-4 font-semibold text-white">{query || filter !== "ALL" ? "No matching content" : "No content yet"}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#777]">{query || filter !== "ALL" ? "Try another search or status filter." : "Create a draft or submit your first post for admin review."}</p>
              {!query && filter === "ALL" && <button type="button" onClick={() => openEditor()} className="mt-5 text-sm font-semibold text-[#F5C400] hover:text-[#FFD83D]">Create your first post</button>}
            </div>
          ) : visible.map((item) => (
            <article key={item.id || item.contentId} className={`${cardClass} p-4 sm:p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#777]">{item.type || "UPDATE"}{item.contentId ? ` · ${item.contentId}` : ""}</p>
                  <h2 className="mt-2 break-words text-lg font-semibold text-white sm:text-xl">{item.title}</h2>
                </div>
                <StatusBadge status={item.viewStatus} />
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#999]">{item.description}</p>
              {safeMediaUrl(item.mediaUrl) && <p className="mt-3 truncate text-xs text-[#777]">Media: <a href={safeMediaUrl(item.mediaUrl)} target="_blank" rel="noreferrer" className="text-[#F5C400] hover:underline">{item.mediaUrl}</a></p>}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#777]">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />Starts {formatDate(item.startDate)}</span>
                <span>Ends {formatDate(item.endDate)}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[#242424] pt-4">
                <ActionButton onClick={() => setPreview(item)}><Eye size={14} />Preview</ActionButton>
                {editable(item) && <ActionButton onClick={() => openEditor(item)}>Edit</ActionButton>}
                <ActionButton onClick={() => duplicate(item)} disabled={busyId === item.id}><Copy size={14} />Duplicate</ActionButton>
                {["DRAFT", "REJECTED"].includes(String(item.status).toUpperCase()) && (
                  <ActionButton onClick={() => updateStatus(item, "SUBMITTED")} disabled={busyId === item.id} accent><Send size={14} />Submit for review</ActionButton>
                )}
                {item.viewStatus !== "ARCHIVED" && (
                  <ActionButton onClick={() => updateStatus(item, "ARCHIVED")} disabled={busyId === item.id}><Archive size={14} />Archive</ActionButton>
                )}
              </div>
            </article>
          ))}
        </section>

        <aside className={`${cardClass} p-4 sm:p-5`}>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-semibold text-white">Published feed preview</p><p className="mt-1 text-xs text-[#777]">How active posts appear to customers</p></div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">LIVE</span>
          </div>
          <div className="mx-auto mt-5 max-w-[300px] rounded-[28px] border-[5px] border-[#282828] bg-[#080808] p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between px-1">
              <div><p className="text-[10px] text-[#777]">BUZZTAP</p><p className="text-sm font-semibold text-white">Discover</p></div>
              <div className="h-7 w-7 rounded-full bg-[#F5C400]/15" />
            </div>
            <div className="space-y-3">
              {dataLoading || (dataError && items.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-[#333] px-4 py-8 text-center">
                  <LoaderCircle size={18} className={`mx-auto ${dataLoading ? "animate-spin text-[#F5C400]" : "text-[#777]"}`} />
                  <p className="mt-3 text-xs font-medium text-[#aaa]">{dataLoading ? "Loading published content…" : "Published content is unavailable"}</p>
                </div>
              ) : feedItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#333] px-4 py-8 text-center">
                  <Megaphone size={18} className="mx-auto text-[#555]" />
                  <p className="mt-3 text-xs font-medium text-[#aaa]">No published posts yet</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#666]">Once Admin Web approves your content, it will show here.</p>
                </div>
              ) : feedItems.map((item) => (
                <article key={item.id || item.contentId} className="overflow-hidden rounded-2xl border border-[#242424] bg-[#151515]">
                  {safeMediaUrl(item.mediaUrl) ? (
                    <img src={safeMediaUrl(item.mediaUrl)} alt="" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-gradient-to-br from-[#F5C400]/20 to-[#211d08]"><FileImage size={23} className="text-[#F5C400]/70" /></div>
                  )}
                  <div className="p-3">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#F5C400]">{item.type || "UPDATE"}</p>
                    <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-[11px] leading-5 text-[#999]">{item.description}</p>
                    {item.callToAction && <span className="mt-3 inline-block rounded-lg bg-[#F5C400] px-3 py-1.5 text-[10px] font-semibold text-black">{item.callToAction}</span>}
                    <p className="mt-3 text-[9px] text-[#666]">{formatDate(item.startDate)}{item.endDate ? ` – ${formatDate(item.endDate)}` : ""}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {editor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="content-editor-title" className="my-auto w-full max-w-2xl rounded-2xl border border-[#333] bg-[#111] p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[#F5C400]">{editor.id ? "Manage your post" : "New post"}</p><h2 id="content-editor-title" className="mt-1 text-xl font-semibold text-white">{editor.id ? "Edit Content" : "Create Content"}</h2><p className="mt-1 text-sm text-[#777]">Submitted posts go to Admin Web for review and publishing.</p></div>
              <button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label="Close editor" className="rounded-lg p-2 text-[#888] hover:bg-[#222] hover:text-white disabled:opacity-50"><X size={18} /></button>
            </div>
            <form onSubmit={(event) => save(event)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Content Type">
                  <select className={inputClass} name="type" defaultValue={editor.type || "UPDATE"}>
                    <option value="UPDATE">Update</option><option value="PROMOTION">Promotion</option><option value="EVENT">Event</option><option value="ADVERTISEMENT">Advertisement</option>
                  </select>
                </Field>
                <Field label="Title"><input className={inputClass} name="title" required maxLength="160" defaultValue={editor.title} placeholder="Give your post a title" /></Field>
              </div>
              <Field label="Post Content"><textarea className={inputClass} name="description" required rows="5" maxLength="5000" defaultValue={editor.description} placeholder="Write the message customers will see…" /></Field>
              <Field label="Media URL"><input className={inputClass} name="mediaUrl" type="url" maxLength="2048" defaultValue={editor.mediaUrl} placeholder="https://…" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start Date"><input className={inputClass} name="startDate" required type="date" defaultValue={editor.startDate || today()} /></Field>
                <Field label="End Date (Optional)"><input className={inputClass} name="endDate" type="date" min={editor.startDate || today()} defaultValue={editor.endDate} /></Field>
              </div>
              <Field label="Call-To-Action Label (Optional)"><input className={inputClass} name="callToAction" maxLength="80" defaultValue={editor.callToAction} placeholder="e.g. Visit us today" /></Field>
              <div className="flex flex-col-reverse gap-3 border-t border-[#242424] pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditor(null)} disabled={saving} className="rounded-xl border border-[#333] px-4 py-3 text-sm font-semibold text-[#ccc] hover:bg-[#1b1b1b] disabled:opacity-50">Cancel</button>
                <Button type="submit" secondary disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : null}Save Draft</Button>
                {editorCanSubmit && <Button type="button" onClick={(event) => save(event, true)} disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}Submit for Review</Button>}
              </div>
            </form>
          </section>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="preview-title" className="w-full max-w-sm rounded-2xl border border-[#333] bg-[#111] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 id="preview-title" className="font-semibold text-white">Customer Preview</h2><button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-lg p-2 text-[#888] hover:bg-[#222] hover:text-white"><X size={18} /></button></div>
            <article className="overflow-hidden rounded-2xl border border-[#292929] bg-[#171717]">
              {safeMediaUrl(preview.mediaUrl) ? <img src={safeMediaUrl(preview.mediaUrl)} alt="" className="h-40 w-full object-cover" /> : <div className="flex h-36 items-center justify-center bg-gradient-to-br from-[#F5C400]/20 to-[#211d08]"><FileImage size={28} className="text-[#F5C400]/70" /></div>}
              <div className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#F5C400]">{preview.type}</p>
                <h3 className="mt-2 text-xl font-bold text-white">{preview.title}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#aaa]">{preview.description}</p>
                {preview.callToAction && <span className="mt-4 inline-block rounded-lg bg-[#F5C400] px-3 py-2 text-xs font-semibold text-black">{preview.callToAction}</span>}
                <p className="mt-4 text-[11px] text-[#666]">{formatDate(preview.startDate)}{preview.endDate ? ` – ${formatDate(preview.endDate)}` : " · Ongoing"}</p>
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  )
}

export default Content
