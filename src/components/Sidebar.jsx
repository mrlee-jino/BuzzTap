import { NavLink } from "react-router-dom"
import { useState } from "react"
import {
  LayoutDashboard,
  Monitor,
  Receipt,
  Users,
  Package,
  BarChart3,
  Settings,
  WalletCards,
  ChevronRight,
  LogOut,
  Megaphone,
} from "lucide-react"
import { Modal } from "./BusinessUI"

function Sidebar({ sidebarOpen, setSidebarOpen, onLogout }) {
  const [confirmLogout, setConfirmLogout] = useState(false)

  const menuItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Workstations",
      path: "/workstations",
      icon: Monitor,
    },
    {
      name: "Transactions",
      path: "/transactions",
      icon: Receipt,
    },
    {
      name: "Customers",
      path: "/customers",
      icon: Users,
    },
    {
      name: "Products & Services",
      path: "/products-services",
      icon: Package,
    },
    {
      name: "Reports",
      path: "/reports",
      icon: BarChart3,
    },
    {
      name: "Customized Buzz Points Wallet",
      path: "/wallet",
      icon: WalletCards,
    },
    {
      name: "Content",
      path: "/content",
      icon: Megaphone,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
    },
  ]

  return (
    <>
    <aside
      onMouseEnter={() => setSidebarOpen(true)}
      onMouseLeave={() => setSidebarOpen(false)}
      className={`
        fixed left-0 top-0 z-50
        h-screen
        bg-[#0D0D0D]
        border-r border-[#242424]
        shadow-[8px_0_30px_rgba(0,0,0,0.35)]
        transition-all duration-300 ease-out
        ${sidebarOpen ? "w-64" : "w-[76px]"}
      `}
    >
      {/* Toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="
          absolute -right-4 top-8
          flex h-8 w-8 items-center justify-center
          rounded-full
          bg-[#F5C400]
          text-black
          shadow-[0_0_20px_rgba(245,196,0,0.25)]
          transition-all duration-300
          hover:scale-110
          hover:bg-[#FFD83D]
        "
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <ChevronRight
          size={17}
          className={`
            transition-transform duration-300
            ${sidebarOpen ? "rotate-180" : ""}
          `}
        />
      </button>

      {/* Brand */}
      <div className="flex h-28 items-center px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="
              flex h-10 w-10 shrink-0 items-center justify-center
              rounded-xl
              bg-[#F5C400]
              text-black
              font-black
              shadow-[0_4px_20px_rgba(245,196,0,0.2)]
            "
          >
            B
          </div>

          <div
            className={`
              overflow-hidden whitespace-nowrap
              transition-all duration-300
              ${
                sidebarOpen
                  ? "max-w-[160px] opacity-100 translate-x-0"
                  : "max-w-0 opacity-0 -translate-x-2"
              }
            `}
          >
            <h1 className="text-lg font-bold text-white">
              BuzzTap
            </h1>

            <p className="text-xs text-[#A3A3A3]">
              Business Management
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3">
        <div className="mb-4 px-2">
          <span
            className={`
              text-[10px] font-semibold uppercase tracking-[0.2em]
              text-[#666]
              transition-opacity duration-300
              ${sidebarOpen ? "opacity-100" : "opacity-0"}
            `}
          >
            Main Menu
          </span>
        </div>

        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.name}
                to={item.path}
                title={!sidebarOpen ? item.name : ""}
                className={({ isActive }) =>
                  `
                  group relative flex h-12 items-center
                  rounded-xl
                  transition-all duration-300
                  ${
                    isActive
                      ? `
                        bg-[#F5C400]
                        text-black
                        shadow-[0_5px_20px_rgba(245,196,0,0.16)]
                      `
                      : `
                        text-[#A3A3A3]
                        hover:bg-[#171717]
                        hover:text-white
                      `
                  }
                  `
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute left-0 h-6 w-1 rounded-r-full bg-black/70" />
                    )}

                    <Icon
                      size={20}
                      strokeWidth={1.8}
                      className={`
                        ml-[15px] shrink-0
                        transition-transform duration-300
                        group-hover:scale-110
                      `}
                    />

                    <span
                      className={`
                        ml-4 whitespace-nowrap text-sm font-medium
                        transition-all duration-300
                        ${
                          sidebarOpen
                            ? "max-w-[180px] opacity-100 translate-x-0"
                            : "max-w-0 opacity-0 -translate-x-3"
                        }
                      `}
                    >
                      {item.name}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Bottom status */}
      <div
        className={`
          absolute bottom-5 left-4 right-4
          rounded-xl border border-[#242424]
          bg-[#111111]
          p-3
          transition-all duration-300
          ${
            sidebarOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3 pointer-events-none"
          }
        `}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#F5C400] shadow-[0_0_10px_#F5C400]" />

          <span className="text-xs text-[#A3A3A3]">
            Online
          </span>
        </div>
        <button onClick={() => setConfirmLogout(true)} className="mt-3 flex w-full items-center gap-2 text-xs text-[#777] hover:text-white" title="Log out">
          <LogOut size={14} /> Log out
        </button>
      </div>
    </aside>
    {confirmLogout && <Modal title="Log out of BuzzTap?" onClose={() => setConfirmLogout(false)}><p className="text-sm text-[#888]">Your session will be cleared and you will return to the login page.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirmLogout(false)} className="rounded-xl border border-[#333] px-4 py-3 text-sm text-white">Cancel</button><button onClick={onLogout} className="rounded-xl bg-[#F5C400] px-4 py-3 text-sm font-semibold text-black">Log out</button></div></Modal>}
    </>
  )
}

export default Sidebar