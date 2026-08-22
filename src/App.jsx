import { BrowserRouter, Routes, Route } from "react-router-dom"

import Sidebar from "./components/Sidebar"

import Dashboard from "./pages/Dashboard"
import Workstations from "./pages/Workstations"
import NFCCards from "./pages/NFCCards"
import Transactions from "./pages/Transactions"
import Customers from "./pages/Customers"
import ProductsServices from "./pages/ProductsServices"
import Reports from "./pages/Reports"
import Settings from "./pages/Settings"

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />

        <main className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workstations" element={<Workstations />} />
            <Route path="/nfc-cards" element={<NFCCards />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/products-services" element={<ProductsServices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App