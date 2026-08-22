import { NavLink } from "react-router-dom"

function Sidebar() {
  const menuItems = [
    { name: "Dashboard", path: "/" },
    { name: "Workstations", path: "/workstations" },
    { name: "NFC Cards", path: "/nfc-cards" },
    { name: "Transactions", path: "/transactions" },
    { name: "Customers", path: "/customers" },
    { name: "Products & Services", path: "/products-services" },
    { name: "Reports", path: "/reports" },
    { name: "Settings", path: "/settings" },
  ]

  return (
    <aside className="w-64 min-h-screen bg-slate-950 text-white p-5">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">BuzzTap</h1>
        <p className="text-sm text-slate-400">
          Business Management
        </p>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `block w-full px-4 py-3 rounded-lg transition ${
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar