import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import Sidebar from "./components/Sidebar"
import { useBusiness } from "./businessContext"

import Dashboard from "./pages/Dashboard"
import LandingPage from "./pages/LandingPage"
import Subscribe from "./pages/Subscribe"
import Checkout from "./pages/Checkout"
import Workstations from "./pages/Workstations"
import Transactions from "./pages/Transactions"
import Customers from "./pages/Customers"
import ProductsServices from "./pages/ProductsServices"
import Reports from "./pages/Reports"
import Settings from "./pages/Settings"
import Wallet from "./pages/Wallet"
import Content from "./pages/Content"
import StaffPurchase from "./pages/StaffPurchase"
import { BusinessProvider } from "./businessData"

function App() {
  return (
    <BusinessProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </BusinessProvider>
  )
}

const ROLE_PATHS = {
  OWNER: ["/", "/workstations", "/transactions", "/customers", "/products-services", "/reports", "/wallet", "/settings", "/content", "/staff-purchase"],
  MANAGER: ["/", "/workstations", "/transactions", "/customers", "/products-services", "/reports", "/wallet", "/content", "/staff-purchase"],
  CASHIER: ["/transactions", "/customers", "/wallet", "/staff-purchase"],
  STAFF: ["/transactions", "/staff-purchase"],
}

function AppLayout() {
  const { staff, authenticateStaff } = useBusiness()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [password, setPassword] = useState("prototype")
  const location = useLocation()
  const navigate = useNavigate()
  const publicPaths = new Set(["/", "/welcome", "/login", "/subscribe", "/checkout"])

  const userRolePaths = useMemo(() => (currentUser ? ROLE_PATHS[currentUser.role] || ["/"] : []), [currentUser])

  if (!currentUser) {
    if (publicPaths.has(location.pathname)) {
      return (
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<Login password={password} onPasswordChange={setPassword} onLogin={(user) => { setCurrentUser(user); navigate("/") }} authenticateStaff={authenticateStaff} staff={staff} />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )
    }

    return <Navigate to="/" replace />
  }

  if (["/login", "/welcome", "/subscribe", "/checkout"].includes(location.pathname)) {
    return <Navigate to="/" replace />
  }

  if (userRolePaths.length && !userRolePaths.includes(location.pathname)) {
    return <Navigate to={userRolePaths[0]} replace />
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <Sidebar currentUser={currentUser} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onLogout={() => { setCurrentUser(null); navigate("/login") }} />
      <main className={`min-h-screen transition-[margin] duration-300 ease-in-out ${sidebarOpen ? "ml-64" : "ml-[76px]"}`}>
        <div className="p-5 sm:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wallet" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER", "STAFF"]} currentUser={currentUser}><Wallet /></ProtectedRoute>} />
            <Route path="/workstations" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER"]} currentUser={currentUser}><Workstations /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER", "STAFF"]} currentUser={currentUser}><Transactions /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER"]} currentUser={currentUser}><Customers /></ProtectedRoute>} />
            <Route path="/products-services" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER"]} currentUser={currentUser}><ProductsServices /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER"]} currentUser={currentUser}><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={["OWNER"]} currentUser={currentUser}><Settings password={password} onPasswordChange={setPassword} /></ProtectedRoute>} />
            <Route path="/content" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER"]} currentUser={currentUser}><Content /></ProtectedRoute>} />
            <Route path="/staff-purchase" element={<ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER", "STAFF"]} currentUser={currentUser}><StaffPurchase /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function ProtectedRoute({ allowedRoles, children, currentUser }) {
  const location = useLocation()

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

function Login({ password, onPasswordChange, staff, authenticateStaff, onLogin }) {
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const businessName = String(form.get("businessName") || "").trim()
    const user = String(form.get("user") || "").trim()
    const pass = String(form.get("password") || "")

    const candidate = authenticateStaff
      ? authenticateStaff(businessName, user, pass)
      : staff.find((member) => {
          const matchesBusiness = member.businessName.toLowerCase() === businessName.toLowerCase()
          const matchesUser = [member.name, member.email].some((value) => value.toLowerCase() === user.toLowerCase())
          return matchesBusiness && matchesUser && member.password === pass && member.status === "ACTIVE"
        })

    if (!candidate || candidate.status !== "ACTIVE") {
      setError("Business Name, User, or Password is incorrect.")
      return
    }

    if (pass !== password && password && password !== "prototype") {
      onPasswordChange(pass)
    }

    setError("")
    onLogin(candidate)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] p-5 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-[#242424] bg-[#111] p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C400] text-xl font-black text-black">B</div>
          <div>
            <p className="font-bold">BuzzTap</p>
            <p className="text-xs text-[#777]">Business Management</p>
          </div>
        </div>

        <p className="mb-2 text-sm font-medium text-[#F5C400]">BUSINESS PORTAL</p>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-[#777]">Sign in to your business dashboard.</p>

        <label className="mt-7 block text-sm text-[#888]">
          Business Name
          <input className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 text-white outline-none focus:border-[#F5C400]" name="businessName" type="text" required defaultValue="CyberHub Gaming Station" />
        </label>

        <label className="mt-4 block text-sm text-[#888]">
          User
          <input className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 text-white outline-none focus:border-[#F5C400]" name="user" type="text" required defaultValue="Jordan Reyes" />
        </label>

        <label className="mt-4 block text-sm text-[#888]">
          Password
          <div className="relative mt-2">
            <input className="w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 pr-12 text-white outline-none focus:border-[#F5C400]" name="password" type={showPassword ? "text" : "password"} required defaultValue="prototype" />
            <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#777] hover:bg-[#222] hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button className="mt-6 w-full rounded-xl bg-[#F5C400] px-4 py-3 font-semibold text-black hover:bg-[#FFD83D]" type="submit">
          Log in
        </button>
      </form>
    </main>
  )
}

export default App