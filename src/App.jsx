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
      <div className="min-h-screen bg-[#080808] text-white">
        <Sidebar />

        <main className="min-h-screen pl-[76px]">
          <div className="p-8">
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
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App