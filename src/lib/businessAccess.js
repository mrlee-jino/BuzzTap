// Business membership roles control both navigation and direct route access.
export const ROLE_PATHS = {
  OWNER: ["/rebates", "/system-logs", "/", "/workstations", "/transactions", "/customers", "/products-services", "/reports", "/wallet", "/settings", "/content", "/staff-purchase"],
  MANAGER: ["/rebates", "/system-logs", "/", "/workstations", "/transactions", "/customers", "/products-services", "/reports", "/wallet", "/content", "/staff-purchase"],
  CASHIER: ["/transactions", "/customers", "/wallet", "/staff-purchase"],
  STAFF: ["/", "/staff-purchase", "/products-services", "/content", "/workstations"],
}

export const canAccessPage = (role, path) => (ROLE_PATHS[role] || []).includes(path)
