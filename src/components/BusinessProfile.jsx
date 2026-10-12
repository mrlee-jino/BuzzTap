import { useEffect, useState } from "react"
import { Building2, MapPin, Clock, Phone, Mail } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { Button, Field, cardClass, inputClass } from "./BusinessUI"
import { PROFILE_IMAGE_BUCKET, PROFILE_IMAGE_TYPES, validateProfileImage } from "../lib/profileImages"

const fields = [
  ["display_name", "Business display name"], ["business_type", "Business category"],
  ["address", "Public address"], ["opening_hours", "Opening hours"],
  ["phone", "Public phone"], ["email", "Public email"], ["website", "Website URL"],
]
const imageUrl = (value) => /^https?:\/\/\S+$/i.test(value || "") ? value : ""

export default function BusinessProfile({ business, role, onProfileChange }) {
  const [profile, setProfile] = useState({ display_name: business.name || "", business_type: business.business_type || "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const canEdit = ["OWNER", "MANAGER"].includes(role)
  useEffect(() => {
    let cancelled = false
    supabase.rpc("get_public_business_profile", { p_business_id: business.id }).then(({ data, error: failure }) => {
      if (cancelled) return
      if (failure) setError(failure.message)
      else if (data) { setProfile(data); onProfileChange?.(data) }
      setLoading(false)
    }).catch((failure) => { if (!cancelled) { setError(failure.message || "Profile could not be loaded."); setLoading(false) } })
    return () => { cancelled = true }
  }, [business.id, onProfileChange])
  const update = (key, value) => { setProfile((current) => ({ ...current, [key]: value })); setNotice("") }
  const uploadImage = async (event, key) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || uploading || saving || !canEdit) return
    setError(""); setNotice("")
    const validationError = validateProfileImage(file)
    if (validationError) { setError(validationError); return }
    setUploading(key)
    try {
      const path = `${business.id}/${key}/${crypto.randomUUID()}.${PROFILE_IMAGE_TYPES[file.type]}`
      const bucket = supabase.storage.from(PROFILE_IMAGE_BUCKET)
      const { error: failure } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
      if (failure) throw failure
      const { data } = bucket.getPublicUrl(path)
      update(key, data.publicUrl)
      setNotice("Image uploaded. Save Business Profile to publish your changes.")
    } catch (failure) { setError(failure.message || "Image upload failed. Please try again.") }
    finally { setUploading(null) }
  }
  const save = async (event) => {
    event.preventDefault()
    if (saving || loading || uploading || !canEdit) return
    setSaving(true); setError(""); setNotice("")
    try {
      const { data, error: failure } = await supabase.rpc("save_public_business_profile", { p_business_id: business.id, p_profile: profile })
      if (failure) throw failure
      setProfile(data)
      onProfileChange?.(data)
      setNotice("Business profile saved. These details are available to the customer application.")
    } catch (failure) { setError(failure.message || "Profile could not be saved.") }
    finally { setSaving(false) }
  }
  return <section className={`${cardClass} mb-5`} aria-label="Business profile">
    <h2 className="text-lg font-semibold text-white">Business Profile</h2>
    <p className="mt-1 text-sm text-[#888]">Set the public details customers see when viewing your business. Contact details entered here are visible to signed-in users.</p>
    <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">{[["logo_url", "Business logo"], ["cover_url", "Cover image"]].map(([key, label]) => <Field key={key} label={label}>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={loading || saving || !!uploading || !canEdit} onChange={(event) => uploadImage(event, key)} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F5C400] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-black disabled:opacity-50`} />
          <span className="mt-2 block text-xs text-[#888]">{uploading === key ? "Uploading image..." : "JPG, PNG, WebP, or GIF · maximum 10 MB per image"}</span>
        </Field>)}</div>
        <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <Field key={key} label={label}><input className={inputClass} value={profile[key] || ""} disabled={loading || saving || !canEdit} required={key === "display_name"} maxLength={500} type={key.endsWith("url") || key === "website" ? "url" : key === "email" ? "email" : "text"} onChange={(event) => update(key, event.target.value)} placeholder={key.endsWith("url") || key === "website" ? "https://..." : label} /></Field>)}</div>
        <Field label="About your business"><textarea className={inputClass} rows={3} maxLength={2000} value={profile.about || ""} disabled={loading || saving || !canEdit} onChange={(event) => update("about", event.target.value)} placeholder="Tell customers what you offer and what makes your business special." /></Field>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
        {canEdit && <Button type="submit" disabled={saving || loading || !!uploading}>{loading ? "Loading profile..." : uploading ? "Uploading image..." : saving ? "Saving..." : "Save Business Profile"}</Button>}
      </form>
      <div><p className="mb-3 text-xs text-[#888]">Customer profile preview · changes appear after saving</p><article className="overflow-hidden rounded-2xl border border-[#ddd] bg-white text-[#172033]">
        <div className="h-32 overflow-hidden bg-gradient-to-r from-[#F5C400]/40 to-[#F5C400]/10">{imageUrl(profile.cover_url) && <img key={profile.cover_url} src={imageUrl(profile.cover_url)} alt="Business cover" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} />}</div>
        <div className="p-5"><div className="flex items-center gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F5C400] text-black">{imageUrl(profile.logo_url) ? <img key={profile.logo_url} src={imageUrl(profile.logo_url)} alt="Business logo" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} /> : <Building2 size={25} />}</div><div><h3 className="break-words text-xl font-bold">{profile.display_name || business.name}</h3><p className="text-xs text-[#6b7280]">{profile.business_type || "Business"}</p></div></div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#4b5563]">{profile.about || "Add a description to introduce your business."}</p>
          <div className="mt-4 space-y-3 text-sm text-[#4b5563]">{[[MapPin,"address"],[Clock,"opening_hours"],[Phone,"phone"],[Mail,"email"]].map(([Icon,key]) => profile[key] && <p key={key} className="flex items-start gap-2"><Icon size={16} className="mt-0.5 shrink-0" /><span className="break-all">{profile[key]}</span></p>)}</div>
          {imageUrl(profile.website) && <a href={imageUrl(profile.website)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-blue-600">Visit website</a>}
          <div className="mt-5 border-t border-[#e5e7eb] pt-4 text-xs text-[#6b7280]">Promotions and updates appear in the business’s published posts.</div>
        </div>
      </article></div>
    </div>
  </section>
}
