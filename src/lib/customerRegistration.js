export function nextCustomerCode(customers, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const part = (type) => parts.find((item) => item.type === type).value
  const prefix = `${part("year")}${part("month")}${part("day")}`
  const highest = customers.reduce((maximum, customer) => {
    const code = customer.customer_code || ""
    if (!/^\d{11}$/.test(code) || !code.startsWith(prefix)) return maximum
    return Math.max(maximum, Number(code.slice(8)))
  }, 0)
  return highest < 999 ? `${prefix}${String(highest + 1).padStart(3, "0")}` : null
}
