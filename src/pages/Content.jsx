import { useEffect, useMemo, useRef, useState } from "react"
import {
  FileImage,
  LoaderCircle,
  Megaphone,
  MoreHorizontal,
  Plus,
  Search,
  Send,
} from "lucide-react"
import { useBusiness } from "../businessContext"
import { Button, Field, PageHeader, cardClass, inputClass } from "../components/BusinessUI"
import { supabase } from "../lib/supabaseClient"

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

function StatusBadge({ status }) {
  const style = status === "PUBLISHED"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : status === "PENDING_REVIEW"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
      : status === "REJECTED"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : status === "ARCHIVED" || status === "EXPIRED"
          ? "border-[#444] bg-[#222] text-[#999]"
          : "border-[#F5C400]/20 bg-[#F5C400]/10 text-[#F5C400]"
  return <span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold ${style}`}>{statusLabel(status)}</span>
}

function isVideoUrl(value) {
  const url = safeMediaUrl(value)
  return Boolean(url && /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(url))
}

function FeedMedia({ url, title }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (!url || failed) {
    return (
      <div className="mx-3 mb-2 flex h-12 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-[10px] text-[#6b7280]">
        <FileImage size={14} className="shrink-0 text-[#9ca3af]" />
        <span>{url ? "Media could not be loaded" : "No media attached"}</span>
      </div>
    )
  }

  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        aria-label={title}
        onError={() => setFailed(true)}
        className="mx-3 mb-2 max-h-[220px] w-[calc(100%-1.5rem)] rounded-lg bg-[#111] object-contain"
      />
    )
  }

  return (
    <div className={`mx-3 mb-2 overflow-hidden rounded-lg bg-[#f3f4f6] ${loaded ? "" : "h-12"}`}>
      <img
        src={url}
        alt={title}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={loaded ? "max-h-[220px] w-full object-cover" : "hidden"}
      />
      {!loaded && (
        <div className="flex h-12 items-center gap-2 px-3 text-[10px] text-[#6b7280]">
          <LoaderCircle size={13} className="animate-spin text-[#9ca3af]" />
          Loading media…
        </div>
      )}
    </div>
  )
}

function Content() {
  const { activities = [], dataLoading, dataError, addActivity, business } = useBusiness()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("WORKING")
  const [feedMode, setFeedMode] = useState("MINE")
  const [communityPosts, setCommunityPosts] = useState([])
  const [communityLoading, setCommunityLoading] = useState(true)
  const [communityError, setCommunityError] = useState("")
  const [editor, setEditor] = useState(null)
  const [previewDraft, setPreviewDraft] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [resetForm, setResetForm] = useState(0)
  const [notice, setNotice] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const formPanel = useRef(null)

  const items = useMemo(
    () => activities.map((item) => ({ ...item, viewStatus: contentStatus(item) })),
    [activities],
  )
  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesStatus = statusFilter === "ALL"
        || (statusFilter === "WORKING" && ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(item.viewStatus))
        || (statusFilter === item.viewStatus)
      const matchesSearch = !search || `${item.title} ${item.type} ${item.description}`.toLowerCase().includes(search)
      return matchesStatus && matchesSearch
    })
  }, [items, query, statusFilter])

  useEffect(() => {
    let cancelled = false
    async function loadCommunityPosts() {
      if (!business?.id || feedMode !== "COMMUNITY") {
        setCommunityPosts([])
        setCommunityLoading(false)
        return
      }
      setCommunityLoading(true)
      setCommunityError("")
      let data
      let error
      try {
        ({ data, error } = await supabase.rpc("get_published_business_content"))
      } catch (requestError) {
        if (cancelled) return
        setCommunityError(requestError instanceof Error ? requestError.message : "The community feed request failed.")
        setCommunityPosts([])
        setCommunityLoading(false)
        return
      }
      if (cancelled) return
      if (error) {
        setCommunityError(error.message)
        setCommunityPosts([])
      } else {
        setCommunityPosts((data || []).map((item) => ({
          ...item,
          contentId: item.content_id || item.id,
          description: item.description || item.content || "",
          startDate: item.start_date || "",
          endDate: item.end_date || "",
          mediaUrl: item.media_url || "",
          callToAction: item.call_to_action || "",
          businessName: item.business_name || "",
        })))
      }
      setCommunityLoading(false)
    }
    loadCommunityPosts()
    return () => { cancelled = true }
  }, [business?.id, feedMode])

  const ownPublished = items.filter((item) => item.viewStatus === "PUBLISHED"
    && (!item.startDate || item.startDate <= today())
    && (!item.endDate || item.endDate >= today()))
  const postsInFeed = feedMode === "MINE"
    ? [...(previewDraft ? [previewDraft] : []), ...ownPublished]
    : communityPosts
  const editorCanSubmit = !editor?.id || ["DRAFT", "REJECTED"].includes(String(editor.status).toUpperCase())
  const canEdit = (item) => ["DRAFT", "REJECTED"].includes(String(item.status).toUpperCase())

  const openCreateForm = () => {
    setEditor(null)
    setPreviewDraft(null)
    setFeedMode("MINE")
    setResetForm((value) => value + 1)
    formPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" })
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
      setNotice("No active business membership is available.")
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
      contentId: editor?.contentId || crypto.randomUUID(),
    })
    setSaving(false)
    if (!result?.success) {
      setNotice(result?.error || "Content could not be saved. Please try again.")
      return
    }
    setNotice(submit ? "Post submitted for admin review. It will appear in the feed after approval." : "Draft saved.")
    setEditor(null)
    setPreviewDraft(null)
    setResetForm((value) => value + 1)
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
    setNotice(result?.success ? "Post duplicated as a draft." : result?.error || "Post could not be duplicated.")
  }

  const updateStatus = async (item, status) => {
    setBusyId(item.id)
    setNotice("")
    const result = await addActivity({ ...item, status })
    setBusyId(null)
    setNotice(result?.success ? "Post archived." : result?.error || "Post could not be archived.")
  }

  const edit = (item) => {
    if (!canEdit(item)) return
    setNotice("")
    setEditor(item)
    setFeedMode("MINE")
    setPreviewDraft({ ...item, viewStatus: contentStatus(item), isDraftPreview: true })
    formPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const updateDraftPreview = (event) => {
    const form = event.currentTarget
    const values = new FormData(form)
    const title = String(values.get("title") || "").trim()
    const description = String(values.get("description") || "").trim()
    const mediaUrl = String(values.get("mediaUrl") || "").trim()
    if (!title && !description && !mediaUrl) {
      setPreviewDraft(null)
      return
    }
    setPreviewDraft({
      ...(editor || {}),
      title: title || "Untitled post",
      description,
      type: String(values.get("type") || "UPDATE"),
      startDate: String(values.get("startDate") || ""),
      endDate: String(values.get("endDate") || ""),
      mediaUrl,
      callToAction: String(values.get("callToAction") || "").trim(),
      status: editor?.status || "DRAFT",
      viewStatus: editor ? contentStatus(editor) : "DRAFT",
      business_id: business?.id,
      isDraftPreview: true,
      id: editor?.id || "local-draft-preview",
    })
  }
  const setCommunityTab = () => {
    if (feedMode === "COMMUNITY") return
    setCommunityLoading(true)
    setCommunityError("")
    setFeedMode("COMMUNITY")
  }

  return (
    <div className="mx-auto max-w-[1700px]">
      <PageHeader
        eyebrow="CONTENT WORKFLOW"
        title="Business Content"
        description="Manage your drafts and submissions, preview the BuzzTap feed, and create a post."
        action={<Button onClick={openCreateForm}><Plus size={17} />Create Post</Button>}
      />

      {(notice || dataError) && (
        <div role="status" className={`mb-4 rounded-xl border p-3 text-sm ${dataError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#F5C400]/30 bg-[#F5C400]/10 text-[#F5C400]"}`}>
          {dataError ? `Database error: ${dataError}` : notice}
        </div>
      )}

      <div className="mb-5 grid gap-3 rounded-2xl border border-[#222] bg-[#111] p-3 sm:grid-cols-[minmax(0,1fr)_190px] sm:p-4">
        <label className="relative min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
          <input className={`${inputClass} pl-9`} placeholder="Search content, type, or ID" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search business content" />
        </label>
        <select className={inputClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter submissions by status">
          <option value="WORKING">Drafts & submissions</option>
          <option value="ALL">All my posts</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="PUBLISHED">Published</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(330px,1.3fr)_minmax(400px,0.95fr)_minmax(340px,1fr)]">
        <section className={`${cardClass} overflow-hidden p-0`} aria-label="Drafts and submissions">
          <header className="border-b border-[#252525] px-4 py-4 sm:px-5">
            <h2 className="font-semibold text-white">Drafts &amp; submissions</h2>
            <p className="mt-1 text-xs text-[#777]">{dataLoading ? "Loading posts…" : `${filteredItems.length} ${filteredItems.length === 1 ? "post" : "posts"}`}</p>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-[#252525] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#666] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5">
            <span>Post</span><span>Status</span><span className="hidden sm:block">Date</span>
          </div>
          <div className="max-h-[620px] divide-y divide-[#222] overflow-y-auto">
            {dataLoading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#888]"><LoaderCircle size={17} className="animate-spin text-[#F5C400]" />Loading posts…</div>
            ) : dataError && items.length === 0 ? (
              <p className="p-6 text-sm text-red-300">Posts could not be loaded: {dataError}</p>
            ) : filteredItems.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Megaphone size={20} className="mx-auto text-[#555]" />
                <p className="mt-3 text-sm font-medium text-white">{query || statusFilter !== "WORKING" ? "No matching posts" : "No drafts or submissions yet"}</p>
                <p className="mt-1 text-xs leading-5 text-[#777]">Create a draft or submit a post for Admin Web review.</p>
              </div>
            ) : filteredItems.map((item) => (
              <article key={item.id || item.contentId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5">
                <div className="min-w-0">
                  {canEdit(item)
                    ? <button type="button" onClick={() => edit(item)} className="block max-w-full truncate text-left text-sm font-semibold text-white hover:text-[#F5C400]">{item.title}</button>
                    : <p className="truncate text-sm font-semibold text-white">{item.title}</p>}
                  <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-[#777]">{item.type || "UPDATE"}{item.contentId ? ` · ${item.contentId}` : ""}</p>
                  <p className="mt-1 text-[10px] text-[#666] sm:hidden">{formatDate(item.created_at?.slice(0, 10) || item.startDate)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {canEdit(item) && <>
                      <button type="button" onClick={() => edit(item)} className="text-[10px] text-[#aaa] hover:text-white">Edit</button>
                      <span className="text-[10px] text-[#444]">·</span>
                    </>}
                    <button type="button" onClick={() => duplicate(item)} disabled={busyId === item.id} className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-50">Duplicate</button>
                    {item.viewStatus !== "ARCHIVED" && (
                      <>
                        <span className="text-[10px] text-[#444]">·</span>
                        <button type="button" onClick={() => updateStatus(item, "ARCHIVED")} disabled={busyId === item.id} className="text-[10px] text-[#aaa] hover:text-white disabled:opacity-50">Archive</button>
                      </>
                    )}
                    {["DRAFT", "REJECTED"].includes(String(item.status).toUpperCase()) && (
                      <>
                        <span className="text-[10px] text-[#444]">·</span>
                        <button type="button" onClick={async () => {
                          setBusyId(item.id)
                          const result = await addActivity({ ...item, status: "SUBMITTED" })
                          setBusyId(null)
                          setNotice(result?.success ? "Post submitted for admin review." : result?.error || "Post could not be submitted.")
                        }} disabled={busyId === item.id} className="text-[10px] font-semibold text-[#F5C400] hover:text-[#FFD83D] disabled:opacity-50">Submit</button>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={item.viewStatus} />
                <span className="hidden whitespace-nowrap text-[10px] text-[#777] sm:block">{formatDate(item.created_at?.slice(0, 10) || item.startDate)}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={`${cardClass} p-4 sm:p-5`} aria-label="BuzzTap post feed preview">
          <header className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-white">Post preview</h2>
              <span className="text-[10px] text-[#777]">Scroll feed</span>
            </div>
            <p className="mt-1 text-xs text-[#777]">{feedMode === "MINE" ? "Your published posts" : "Published BuzzTap community posts"} · {feedMode === "MINE" ? ownPublished.length : postsInFeed.length} posts</p>
          </header>
          <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#090909] p-1" role="group" aria-label="Choose feed posts">
            <button type="button" onClick={() => setFeedMode("MINE")} aria-pressed={feedMode === "MINE"} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${feedMode === "MINE" ? "bg-[#F5C400] text-black" : "text-[#888] hover:text-white"}`}>My posts</button>
            <button type="button" onClick={setCommunityTab} aria-pressed={feedMode === "COMMUNITY"} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${feedMode === "COMMUNITY" ? "bg-[#F5C400] text-black" : "text-[#888] hover:text-white"}`}>Community</button>
          </div>
          <div className="mx-auto w-full max-w-[360px] rounded-[36px] border-[7px] border-[#303030] bg-[#050505] p-2 shadow-xl">
            <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-[#333]" />
            <div className="flex items-center justify-between rounded-t-[27px] bg-white px-4 py-3">
              <div><p className="text-sm font-bold text-[#111]">BuzzTap</p></div>
              <span className="text-[10px] font-medium text-[#666]">Business posts</span>
            </div>
            <div className="h-[620px] max-h-[620px] space-y-3 overflow-x-hidden overflow-y-auto rounded-b-[27px] bg-[#f3f4f6] p-2 scrollbar-thin">
              {feedMode === "COMMUNITY" && communityLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-xs text-[#666]"><LoaderCircle size={15} className="animate-spin text-[#F5C400]" />Loading community posts…</div>
              ) : feedMode === "COMMUNITY" && communityError ? (
                <div className="rounded-xl border border-red-200 bg-white p-4 text-center text-xs leading-5 text-red-600">Community posts are unavailable: {communityError}</div>
              ) : postsInFeed.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d1d5db] bg-white px-4 py-10 text-center">
                  <Megaphone size={19} className="mx-auto text-[#9ca3af]" />
                  <p className="mt-3 text-xs font-medium text-[#374151]">{feedMode === "MINE" ? "No published posts yet" : "No community posts yet"}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#6b7280]">{feedMode === "MINE" ? "Your posts appear here after Admin Web approves them." : "Approved business posts will appear here."}</p>
                </div>
              ) : postsInFeed.map((item) => (
                <article key={item.id || item.contentId} className="overflow-hidden rounded-xl border border-[#d1d5db] bg-white text-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                  {item.isDraftPreview && (
                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-medium text-amber-800">
                      Live draft preview · not published
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 p-3 pb-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5C400] text-xs font-black text-black">
                      {(feedMode === "MINE" ? business?.name : item.businessName || (item.business_id === business?.id ? business?.name : ""))?.trim()?.slice(0, 1)?.toUpperCase() || "B"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#111827]">{feedMode === "MINE" ? business?.name || "Your business" : item.businessName || (item.business_id === business?.id ? business?.name : "") || "BuzzTap Community"}</p>
                      <p className="text-[10px] text-[#6b7280]">{formatDate(item.created_at?.slice(0, 10) || item.startDate)} | {statusLabel(item.status || item.viewStatus || contentStatus(item))}</p>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === (item.id || item.contentId) ? null : (item.id || item.contentId))}
                        aria-label="Post options"
                        aria-expanded={openMenuId === (item.id || item.contentId)}
                        className="rounded-full p-1 text-[#6b7280] hover:bg-[#f3f4f6]"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {openMenuId === (item.id || item.contentId) && (
                        <div className="absolute right-0 top-8 z-10 min-w-32 rounded-lg border border-[#e5e7eb] bg-white p-1 shadow-lg">
                          {safeMediaUrl(item.mediaUrl)
                            ? <a href={safeMediaUrl(item.mediaUrl)} target="_blank" rel="noreferrer" className="block rounded-md px-2.5 py-2 text-[10px] text-[#374151] hover:bg-[#f3f4f6]">Open media</a>
                            : <span className="block px-2.5 py-2 text-[10px] text-[#9ca3af]">No additional options</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <p className="text-sm font-bold text-[#111827]">{item.title}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#374151]">{item.description}</p>
                  </div>
                  <FeedMedia key={`${item.id || item.contentId}-${item.mediaUrl || "no-media"}`} url={safeMediaUrl(item.mediaUrl)} title={item.title} />
                  <div className="mx-3 flex justify-around border-t border-[#e5e7eb] py-2.5 text-[10px] text-[#4b5563]"><span>Like</span><span>Comment</span><span>Share</span></div>
                  {item.callToAction && <div className="px-3 pb-3"><span className="block rounded-md bg-blue-600 px-3 py-2.5 text-center text-xs font-semibold text-white">{item.callToAction}</span></div>}
                </article>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] leading-4 text-[#666]">Only posts published by Admin Web appear in this feed.</p>
        </section>

        <section ref={formPanel} className={`${cardClass} scroll-mt-6 p-4 sm:p-5`} aria-label="Create BuzzTap post">
          <header className="mb-4 border-b border-[#292929] pb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-white">{editor ? "Edit Post" : "Create BuzzTap post"}</h2>
              {editor && <button type="button" onClick={() => { setEditor(null); setPreviewDraft(null); setResetForm((value) => value + 1) }} className="text-xs text-[#F5C400] hover:text-[#FFD83D]">Cancel edit</button>}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#777]">{editor ? "Update a draft or pending submission." : "Save a draft or submit a post to Admin Web for approval."}</p>
          </header>
          <form key={`${editor?.id || "new"}-${resetForm}`} onInput={updateDraftPreview} onChange={updateDraftPreview} onSubmit={(event) => save(event)} className="space-y-3.5">
            <Field label="Title"><input className={inputClass} name="title" required maxLength="160" defaultValue={editor?.title || ""} placeholder="Post title" /></Field>
            <Field label="Content Type">
              <select className={inputClass} name="type" defaultValue={editor?.type || "UPDATE"}>
                <option value="UPDATE">Update</option><option value="PROMOTION">Promotion</option><option value="EVENT">Event</option><option value="ADVERTISEMENT">Advertisement</option>
              </select>
            </Field>
            <Field label="Post Content"><textarea className={inputClass} name="description" required rows="5" maxLength="5000" defaultValue={editor?.description || ""} placeholder="Write the post…" /></Field>
            <Field label="Media URL"><input className={inputClass} name="mediaUrl" type="url" maxLength="2048" defaultValue={editor?.mediaUrl || ""} placeholder="https://…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date"><input className={inputClass} name="startDate" required type="date" defaultValue={editor?.startDate || today()} /></Field>
              <Field label="End Date"><input className={inputClass} name="endDate" type="date" min={editor?.startDate || today()} defaultValue={editor?.endDate || ""} /></Field>
            </div>
            <Field label="Call To Action"><input className={inputClass} name="callToAction" maxLength="80" defaultValue={editor?.callToAction || ""} placeholder="Optional button label" /></Field>
            <div className="space-y-2 pt-1">
                  <Button type="submit" secondary disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : null}Save draft</Button>
              {editorCanSubmit && (
                <button type="button" onClick={(event) => save(event, true)} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5C400] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#FFD83D] disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                  Submit for Admin Review
                </button>
              )}
            </div>
            <p className="text-[10px] leading-4 text-[#666]">Businesses can submit posts and manage drafts. Admin Web alone can approve and publish them to the community feed.</p>
          </form>
        </section>
      </div>
    </div>
  )
}

export default Content
