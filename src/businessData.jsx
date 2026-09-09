import { useState } from "react"
import { BusinessContext } from "./businessContext"

const initialCustomers = [
  { id: "CUS-001", name: "Juan Dela Cruz", email: "juan@example.com", wallet: 1250, card: "NFC-1001", status: "Active" },
  { id: "CUS-002", name: "Maria Santos", email: "maria@example.com", wallet: 840, card: "NFC-1002", status: "Active" },
  { id: "CUS-003", name: "Alex Reyes", email: "alex@example.com", wallet: 320, card: "NFC-1003", status: "Active" },
  { id: "CUS-004", name: "Sam Navarro", email: "sam@example.com", wallet: 95, card: null, status: "Active" },
]

const initialTransactions = [
  { id: "TXN-1048", type: "CUSTOMER_PURCHASE", customer: "Juan Dela Cruz", card: "NFC-1001", workstation: "WS-002", amount: 150, status: "COMPLETED", date: "Today, 10:42 AM" },
  { id: "TXN-1047", type: "CUSTOMER_LOAD", customer: "Maria Santos", card: "NFC-1002", workstation: "-", amount: 500, status: "COMPLETED", date: "Today, 09:18 AM" },
  { id: "TXN-1046", type: "CUSTOMER_PURCHASE", customer: "Alex Reyes", card: "NFC-1003", workstation: "WS-007", amount: 75, status: "COMPLETED", date: "Yesterday, 08:31 PM" },
  { id: "TXN-1045", type: "REFUND", customer: "Maria Santos", card: "NFC-1002", workstation: "-", amount: 120, status: "REFUNDED", date: "Yesterday, 06:12 PM" },
]

const initialCards = [
  { id: "NFC-1001", customer: "Juan Dela Cruz", issued: "Jan 12, 2026", status: "ACTIVE" },
  { id: "NFC-1002", customer: "Maria Santos", issued: "Feb 04, 2026", status: "ACTIVE" },
  { id: "NFC-1003", customer: "Alex Reyes", issued: "Mar 18, 2026", status: "ACTIVE" },
  { id: "NFC-1004", customer: "-", issued: "Apr 02, 2026", status: "LOST" },
]

const initialProducts = [
  { id: "PROD-001", name: "Gaming Hour", description: "One hour workstation access", category: "Gaming", price: 100, status: "ACTIVE" },
  { id: "PROD-002", name: "Energy Drink", description: "Cold 330ml can", category: "Refreshments", price: 50, status: "ACTIVE" },
  { id: "PROD-003", name: "Premium Headset", description: "Rental per session", category: "Equipment", price: 75, status: "OUT_OF_STOCK" },
]

const initialWorkstations = [
  { id: "WS-001", name: "Station 01", type: "Gaming PC", location: "Station Area", rate: 25, device: "Station Controller #001", status: "ACTIVE" },
  { id: "WS-002", name: "Station 02", type: "Gaming PC", location: "Station Area", rate: 25, device: "Station Controller #002", status: "IN_USE", customer: "Juan Dela Cruz" },
  { id: "WS-003", name: "Station 03", type: "Standard PC", location: "Station Area", rate: 20, device: "Station Controller #003", status: "MAINTENANCE" },
]

const initialStaff = [
  { id: "STAFF-001", businessName: "CyberHub Gaming Station", name: "Jordan Reyes", email: "owner@cyberhub.example", password: "prototype", role: "OWNER", status: "ACTIVE" },
  { id: "STAFF-002", businessName: "CyberHub Gaming Station", name: "Mika Cruz", email: "mika@cyberhub.example", password: "prototype", role: "MANAGER", status: "SUSPENDED" },
  { id: "STAFF-003", businessName: "CyberHub Gaming Station", name: "Leo Tan", email: "leo@cyberhub.example", password: "prototype", role: "CASHIER", status: "INVITED" },
]

export function BusinessProvider({ children }) {
  const [customers, setCustomers] = useState(initialCustomers)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [activities, setActivities] = useState([
    { action: "Customer purchased 150 BP", target: "Juan Dela Cruz", timestamp: "Today, 10:42 AM", reference: "TXN-1048" },
    { action: "Customer loaded 500 BP", target: "Maria Santos", timestamp: "Today, 09:18 AM", reference: "TXN-1047" },
    { action: "NFC card registered", target: "NFC-1003", timestamp: "Yesterday, 02:40 PM", reference: "CARD-1003" },
  ])
  const [wallet, setWallet] = useState({ purchased: 10000, distributed: 6000, collected: 3200, pendingSettlement: 500, settled: 2700 })
  const [purchaseRequests, setPurchaseRequests] = useState([])
  const [settlementRequests, setSettlementRequests] = useState([])
  const [cards, setCards] = useState(initialCards)
  const [products, setProducts] = useState(initialProducts)
  const [workstations, setWorkstations] = useState(initialWorkstations)
  const [staff, setStaff] = useState(initialStaff)

  const addActivity = (action, target, reference) => setActivities((current) => [{ action, target, reference, timestamp: "Just now" }, ...current])

  const loadPoints = (customerId, amount) => {
    if (amount <= 0 || amount > wallet.purchased - wallet.distributed) return false
    const customer = customers.find((item) => item.id === customerId)
    setCustomers((current) => current.map((item) => item.id === customerId ? { ...item, wallet: item.wallet + amount } : item))
    setWallet((current) => ({ ...current, distributed: current.distributed + amount }))
    const id = `TXN-${1050 + transactions.length}`
    setTransactions((current) => [{ id, type: "CUSTOMER_LOAD", customer: customer.name, card: customer.card || "-", workstation: "-", amount, status: "COMPLETED", date: "Just now" }, ...current])
    addActivity(`Customer loaded ${amount.toLocaleString()} BP`, customer.name, id)
    return true
  }

  const purchase = (customerId, amount, product = "Product") => {
    const customer = customers.find((item) => item.id === customerId)
    if (!customer || amount <= 0 || customer.wallet < amount) return false
    const id = `TXN-${1050 + transactions.length}`
    setCustomers((current) => current.map((item) => item.id === customerId ? { ...item, wallet: item.wallet - amount } : item))
    setWallet((current) => ({ ...current, collected: current.collected + amount }))
    setTransactions((current) => [{ id, type: "CUSTOMER_PURCHASE", customer: customer.name, card: customer.card || "-", workstation: "-", amount, status: "COMPLETED", date: "Just now", product }, ...current])
    addActivity(`Customer purchased ${amount.toLocaleString()} BP`, customer.name, id)
    return true
  }

  const refund = (transaction) => {
    if (transaction.status === "REFUNDED") return false
    const customer = customers.find((item) => item.name === transaction.customer)
    if (customer) setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, wallet: item.wallet + transaction.amount } : item))
    setWallet((current) => ({ ...current, collected: Math.max(0, current.collected - transaction.amount) }))
    setTransactions((current) => current.map((item) => item.id === transaction.id ? { ...item, status: "REFUNDED" } : item).concat({ ...transaction, id: `REF-${transaction.id}`, type: "REFUND", status: "REFUNDED", date: "Just now" }))
    addActivity(`Refunded ${transaction.amount.toLocaleString()} BP`, transaction.customer, `REF-${transaction.id}`)
    return true
  }

  const log = (action, target, reference = target) => addActivity(action, target, reference)
  const addCustomer = (customer) => { const id = customer.id || `CUS-${String(customers.length + 1).padStart(3, "0")}`; if (customers.some((item) => item.id === id || item.email === customer.email)) return false; setCustomers((current) => [...current, { ...customer, id, wallet: 0, status: customer.status || "ACTIVE", card: null }]); log("Customer registered", customer.name, id); return true }
  const updateCustomerStatus = (id, status, reason = "") => { setCustomers((current) => current.map((item) => item.id === id ? { ...item, status, statusReason: reason } : item)); log(`Customer status changed to ${status}`, id) }
  const addCard = (card) => { if (cards.some((item) => item.id === card.id) || !customers.some((item) => item.id === card.customerId)) return false; const customer = customers.find((item) => item.id === card.customerId); setCards((current) => [...current, { id: card.id, customer: customer.name, issued: "Today", status: card.status || "ACTIVE" }]); setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, card: card.id } : item)); log("NFC card registered", card.id, card.id); return true }
  const replaceCard = (oldId, newId) => { if (cards.some((item) => item.id === newId)) return false; const old = cards.find((item) => item.id === oldId); if (!old) return false; setCards((current) => [...current.map((item) => item.id === oldId ? { ...item, status: "REPLACED" } : item), { ...old, id: newId, issued: "Today", status: "ACTIVE" }]); setCustomers((current) => current.map((item) => item.card === oldId ? { ...item, card: newId } : item)); log("NFC card replaced", oldId, newId); return true }
  const updateCardStatus = (id, status) => { setCards((current) => current.map((item) => item.id === id ? { ...item, status } : item)); log(`NFC card ${status.toLowerCase()}`, id) }
  const addProduct = (product) => { if (products.some((item) => item.id === product.id)) return false; setProducts((current) => [...current, { ...product, status: product.status || "ACTIVE" }]); log("Product created", product.name, product.id); return true }
  const updateProductStatus = (id, status) => { setProducts((current) => current.map((item) => item.id === id ? { ...item, status } : item)); log(`Product status changed to ${status}`, id) }
  const addWorkstation = (station) => { if (workstations.some((item) => item.id === station.id)) return false; setWorkstations((current) => [...current, { ...station, status: station.status || "ACTIVE" }]); log("Workstation created", station.name, station.id); return true }
  const updateWorkstationStatus = (id, status) => { setWorkstations((current) => current.map((item) => item.id === id ? { ...item, status } : item)); log(`Workstation status changed to ${status}`, id) }
  const addStaff = (member) => {
    if (staff.some((item) => item.email === member.email)) return false
    const safeMember = {
      ...member,
      businessName: member.businessName || "CyberHub Gaming Station",
      password: member.password || "prototype",
      role: member.role || "STAFF",
      status: member.status || "ACTIVE",
    }
    const id = `STAFF-${String(staff.length + 1).padStart(3, "0")}`
    setStaff((current) => [...current, { ...safeMember, id }])
    log("Staff account created", safeMember.name, id)
    return true
  }
  const updateStaffStatus = (id, status) => { setStaff((current) => current.map((item) => item.id === id ? { ...item, status } : item)); log(`Staff status changed to ${status}`, id) }

  return <BusinessContext.Provider value={{ business: { id: "BUS-001", name: "CyberHub Gaming Station" }, customers, transactions, activities, wallet, purchaseRequests, settlementRequests, cards, products, workstations, staff, loadPoints, purchase, refund, addActivity, addCustomer, updateCustomerStatus, addCard, replaceCard, updateCardStatus, addProduct, updateProductStatus, addWorkstation, updateWorkstationStatus, addStaff, updateStaffStatus, requestPurchase: (request) => setPurchaseRequests((current) => [{ ...request, status: "PENDING", id: `BP-${current.length + 1}` }, ...current]), requestSettlement: (request) => setSettlementRequests((current) => [{ ...request, status: "PENDING", id: `SET-${current.length + 1}` }, ...current]) }}>{children}</BusinessContext.Provider>
}
