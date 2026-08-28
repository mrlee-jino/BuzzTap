import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import Sidebar from "./components/Sidebar"

import Dashboard from "./pages/Dashboard"
import Workstations from "./pages/Workstations"
import NFCCards from "./pages/NFCCards"
import Transactions from "./pages/Transactions"
import Customers from "./pages/Customers"
import ProductsServices from "./pages/ProductsServices"
import Reports from "./pages/Reports"
import Settings from "./pages/Settings"
import Wallet from "./pages/Wallet"
import Content from "./pages/Content"
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

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState("prototype")
  const location = useLocation()
  const navigate = useNavigate()

  if (!authenticated) {
    if (location.pathname !== "/login") return <Navigate to="/login" replace />
    return <Login password={password} onLogin={() => { setAuthenticated(true); navigate("/") }} />
  }

  if (location.pathname === "/login") return <Navigate to="/" replace />

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onLogout={() => { setAuthenticated(false); navigate("/login") }} />
      <main className={`min-h-screen transition-[margin] duration-300 ease-in-out ${sidebarOpen ? "ml-64" : "ml-[76px]"}`}>
        <div className="p-5 sm:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/workstations" element={<Workstations />} />
            <Route path="/nfc-cards" element={<NFCCards />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/products-services" element={<ProductsServices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings password={password} onPasswordChange={setPassword} />} />
            <Route path="/content" element={<Content />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
      </main>
    </div>
  )
}

function Login({ password, onLogin }) {
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  return <main className="flex min-h-screen items-center justify-center bg-[#080808] p-5 text-white"><form onSubmit={(event) => { event.preventDefault(); if (event.currentTarget.password.value !== password) { setError("Invalid email or password."); return } onLogin() }} className="w-full max-w-md rounded-2xl border border-[#242424] bg-[#111] p-8 shadow-2xl"><div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5C400] text-xl font-black text-black">B</div><div><p className="font-bold">BuzzTap</p><p className="text-xs text-[#777]">Business Management</p></div></div><p className="mb-2 text-sm font-medium text-[#F5C400]">BUSINESS PORTAL</p><h1 className="text-3xl font-bold">Welcome back</h1><p className="mt-2 text-sm text-[#777]">Sign in to CyberHub Gaming Station.</p><label className="mt-7 block text-sm text-[#888]">Email<input className="mt-2 w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 text-white outline-none focus:border-[#F5C400]" name="email" type="email" required defaultValue="owner@cyberhub.example" /></label><label className="mt-4 block text-sm text-[#888]">Password<div className="relative mt-2"><input className="w-full rounded-xl border border-[#292929] bg-[#0A0A0A] px-4 py-3 pr-12 text-white outline-none focus:border-[#F5C400]" name="password" type={showPassword ? "text" : "password"} required defaultValue="prototype" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#777] hover:bg-[#222] hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<button className="mt-6 w-full rounded-xl bg-[#F5C400] px-4 py-3 font-semibold text-black hover:bg-[#FFD83D]" type="submit">Sign in</button><p className="mt-4 text-center text-xs text-[#666]">Prototype access. Authorization will be enforced by the backend.</p></form></main>
}

export default App