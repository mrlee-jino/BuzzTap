export function isRunningPost(item, date) {
  return String(item.status || "").toUpperCase() === "PUBLISHED"
    && (!(item.startDate || item.start_date) || (item.startDate || item.start_date) <= date)
    && (!(item.endDate || item.end_date) || (item.endDate || item.end_date) >= date)
}

export function communityPost(item, names, logos = new Map()) {
  return {
    ...item,
    description: item.content || item.description || "",
    startDate: item.start_date || "",
    endDate: item.end_date || "",
    mediaUrl: item.media_url || "",
    callToAction: item.call_to_action || "",
    businessName: item.business_id == null ? "BuzzTap Admin" : names.get(item.business_id) || "BuzzTap Business",
    businessLogo: item.business_id == null ? "" : logos.get(item.business_id) || "",
  }
}
