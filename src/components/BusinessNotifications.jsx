import { useEffect, useState } from "react"
import { Bell, Check, LoaderCircle, RefreshCw } from "lucide-react"
import { supabase } from "../lib/supabaseClient"

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "Date unavailable"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export default function BusinessNotifications({ businessId }) {
  const [notifications, setNotifications] = useState([])
  const [notificationsBusinessId, setNotificationsBusinessId] = useState(null)
  const [loading, setLoading] = useState(Boolean(businessId))
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [markingId, setMarkingId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let active = true

    async function loadNotifications() {
      if (!businessId) {
        setNotifications([])
        setNotificationsBusinessId(null)
        setLoading(false)
        setLoadError("")
        return
      }

      setLoading(true)
      setLoadError("")

      const { data, error } = await supabase
        .from("business_notifications")
        .select("id, business_id, title, message, created_at, read_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })

      if (!active) return

      if (error) {
        setLoadError(error.message || "Notifications could not be loaded.")
        setNotifications([])
        setNotificationsBusinessId(null)
      } else {
        setNotifications(data || [])
        setNotificationsBusinessId(businessId)
      }

      setLoading(false)
    }

    loadNotifications()

    return () => {
      active = false
    }
  }, [businessId, refreshKey])

  const visibleNotifications =
    notificationsBusinessId === businessId ? notifications : []
  const unreadCount = visibleNotifications.filter((item) => !item.read_at).length

  async function markAsRead(notification) {
    if (!businessId || notification.read_at || markingId === notification.id) return

    const optimisticReadAt = new Date().toISOString()
    setActionError("")
    setMarkingId(notification.id)
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: optimisticReadAt } : item,
      ),
    )

    const { error } = await supabase.rpc("mark_business_notification_read", {
      p_notification_id: notification.id,
      p_business_id: businessId,
    })

    if (error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read_at: null } : item,
        ),
      )
      setActionError(error.message || "This notification could not be marked as read.")
    }

    setMarkingId(null)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen) setRefreshKey((key) => key + 1)
        }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-controls="business-notifications-inbox"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#333] bg-[#111] text-[#DDD] transition hover:border-[#F5C400]/60 hover:text-white"
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F5C400] px-1 text-[10px] font-bold text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          id="business-notifications-inbox"
          aria-label="Business notifications"
          className="fixed right-3 top-20 z-[60] flex max-h-[calc(100dvh-6rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[#333] bg-[#111] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[#292929] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Notifications</h2>
              <p className="mt-0.5 text-xs text-[#888]">
                {unreadCount} unread
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              disabled={loading}
              aria-label="Refresh notifications"
              title="Refresh notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#999] transition hover:bg-[#222] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </header>

          {actionError && (
            <p role="alert" className="border-b border-red-900/60 bg-red-950/40 px-4 py-2 text-xs text-red-300">
              {actionError}
            </p>
          )}

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#999]" role="status">
                <LoaderCircle size={17} className="animate-spin" />
                Loading notifications...
              </div>
            ) : loadError ? (
              <div className="px-4 py-8 text-center">
                <p role="alert" className="text-sm text-red-300">{loadError}</p>
                <button
                  type="button"
                  onClick={() => setRefreshKey((key) => key + 1)}
                  className="mt-3 text-sm font-medium text-[#F5C400] hover:text-[#FFD83D]"
                >
                  Try again
                </button>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[#888]">
                You’re all caught up.
              </p>
            ) : (
              <ul>
                {visibleNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`border-b border-[#242424] px-4 py-4 last:border-b-0 ${
                      notification.read_at ? "" : "bg-[#F5C400]/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read_at ? "bg-transparent" : "bg-[#F5C400]"}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-semibold text-white">
                          {notification.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-[#AAA]">
                          {notification.message}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <time dateTime={notification.created_at} className="text-xs text-[#777]">
                            {formatDate(notification.created_at)}
                          </time>
                          {!notification.read_at && (
                            <button
                              type="button"
                              onClick={() => markAsRead(notification)}
                              disabled={markingId === notification.id}
                              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#F5C400] hover:text-[#FFD83D] disabled:opacity-50"
                            >
                              {markingId === notification.id ? (
                                <LoaderCircle size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  )
}