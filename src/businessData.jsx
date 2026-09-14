import { useState } from "react"
import { BusinessContext } from "./businessContext"

const emptyWallet = {
  purchased: 0,
  distributed: 0,
  collected: 0,
  pendingSettlement: 0,
  settled: 0,
}

export function BusinessProvider({ children }) {
  const [customers] = useState([])
  const [transactions] = useState([])
  const [activities] = useState([])
  const [wallet] = useState(emptyWallet)
  const [purchaseRequests] = useState([])
  const [settlementRequests] = useState([])
  const [cards] = useState([])
  const [products] = useState([])
  const [workstations] = useState([])
  const [staff] = useState([])

  const authenticateStaff = () => null
  const loadPoints = () => false
  const purchase = () => false
  const refund = () => false
  const addActivity = () => false
  const addCustomer = () => false
  const updateCustomerStatus = () => false
  const addCard = () => false
  const replaceCard = () => false
  const updateCardStatus = () => false
  const addProduct = () => false
  const updateProductStatus = () => false
  const addWorkstation = () => false
  const updateWorkstationStatus = () => false
  const addStaff = () => false
  const updateStaffStatus = () => false
  const purchaseInventory = () => false
  const requestPurchase = () => false
  const requestSettlement = () => false

  return (
    <BusinessContext.Provider
      value={{
        business: null,
        customers,
        transactions,
        activities,
        wallet,
        purchaseRequests,
        settlementRequests,
        cards,
        products,
        workstations,
        staff,
        authenticateStaff,
        loadPoints,
        purchase,
        refund,
        addActivity,
        addCustomer,
        updateCustomerStatus,
        addCard,
        replaceCard,
        updateCardStatus,
        addProduct,
        updateProductStatus,
        addWorkstation,
        updateWorkstationStatus,
        addStaff,
        updateStaffStatus,
        purchaseInventory,
        requestPurchase,
        requestSettlement,
      }}
    >
      {children}
    </BusinessContext.Provider>
  )
}
