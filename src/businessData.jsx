import { useMemo } from "react"

import { BusinessContext } from "./businessContext"
import { useAuth } from "./context/useAuth"

const emptyWallet = {
  purchased: 0,
  distributed: 0,
  collected: 0,
  pendingSettlement: 0,
  settled: 0,
}

export function BusinessProvider({ children }) {
  const {
    user,
    profile,
    memberships,
    loading: authLoading,
    error: authError,
    isAuthenticated,
  } = useAuth()

  /*
   * For now, Business Web uses the authenticated user's
   * active business membership.
   *
   * Multi-business selection can be added later without
   * changing the database structure.
   */
  const activeMemberships = useMemo(
    () =>
      (memberships || []).filter(
        (membership) =>
          membership.status === "ACTIVE" &&
          membership.businesses
      ),
    [memberships]
  )

  /*
   * Current Business
   *
   * At this stage, if the user has exactly one active business,
   * use it automatically.
   *
   * If the user has multiple businesses, we intentionally do
   * not randomly select one.
   */
  const business = useMemo(() => {
    if (activeMemberships.length !== 1) {
      return null
    }

    return activeMemberships[0].businesses
  }, [activeMemberships])

  const currentMembership = useMemo(() => {
    if (activeMemberships.length !== 1) {
      return null
    }

    return activeMemberships[0]
  }, [activeMemberships])

  const businessRole = currentMembership?.role || null

  /*
   * These arrays remain empty for now.
   *
   * We will connect each one to Supabase in separate phases
   * so we don't introduce multiple database/RLS problems at once.
   */
  const customers = []
  const transactions = []
  const activities = []
  const purchaseRequests = []
  const settlementRequests = []
  const cards = []
  const products = []
  const workstations = []
  const staff = []

  /*
   * Wallet remains neutral until the real wallet/ledger
   * tables are connected.
   */
  const wallet = emptyWallet

  /*
   * Existing mutation API is intentionally kept so the
   * existing pages don't break while we migrate them
   * from mock data to Supabase.
   *
   * These will be replaced with real Supabase mutations
   * in later phases.
   */
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
        /*
         * Authentication / business identity
         */
        user,
        profile,
        memberships,
        activeMemberships,
        currentMembership,
        business,
        businessRole,
        isAuthenticated,
        authLoading,
        authError,

        /*
         * Business data
         */
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

        /*
         * Existing API
         */
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