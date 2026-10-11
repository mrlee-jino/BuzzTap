export function sessionCustomerName(session, customers) {
  return session?.customer_name || session?.guest_name
    || customers.find((customer) => String(customer.id) === String(session?.customer_id))?.name
    || "Customer not recorded"
}

export function sessionRemaining(session, now) {
  const end = session?.ends_at ? Date.parse(session.ends_at) : NaN
  if (!Number.isFinite(end)) return null
  return Math.max(0, Math.ceil((end - now) / 1000))
}

export function formatRemaining(seconds) {
  if (seconds == null) return "Time not recorded"
  if (seconds === 0) return "Time expired"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}
