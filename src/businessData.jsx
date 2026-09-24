import { useCallback, useEffect, useMemo, useState } from "react"

import { supabase } from "./lib/supabaseClient"
import { BusinessContext } from "./businessContext"
import { useAuth } from "./context/useAuth"

const emptyWallet = { purchased: 0, distributed: 0, collected: 0, pendingSettlement: 0, settled: 0 }
const emptyData = { customers: [], transactions: [], activities: [], purchaseRequests: [], settlementRequests: [], cards: [], products: [], workstations: [], staff: [] }

const money = (value) => Number(value || 0)
const displayDate = (value) => value ? new Date(value).toLocaleString() : ""
const idFor = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`

export function BusinessProvider({ children }) {
  const { user, profile, memberships, loading: authLoading, error: authError, isAuthenticated } = useAuth()
  const [data, setData] = useState(emptyData)
  const [wallet, setWallet] = useState(emptyWallet)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState(null)

  const activeMemberships = useMemo(
    () => (memberships || []).filter((item) => item.status === "ACTIVE" && item.businesses),
    [memberships],
  )
  const business = useMemo(() => activeMemberships.length === 1 ? activeMemberships[0].businesses : null, [activeMemberships])
  const currentMembership = useMemo(() => activeMemberships.length === 1 ? activeMemberships[0] : null, [activeMemberships])
  const businessRole = currentMembership?.role || null

  const loadData = useCallback(async () => {
    if (!business?.id) {
      setData(emptyData)
      setWallet(emptyWallet)
      return
    }
    setDataLoading(true)
    setDataError(null)
    const bid = business.id
    const queries = await Promise.all([
      supabase.from("customers").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("products_services").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("workstations").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("nfc_cards").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("wallet_ledger").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("business_transactions").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("business_invitations").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("purchase_requests").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("settlement_requests").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
      supabase.from("content_items").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
    ])
    const failure = queries.find((result) => result.error)
    if (failure) {
      setDataError(failure.error.message)
      setDataLoading(false)
      return
    }
    const [customerResult, productResult, workstationResult, cardResult, ledgerResult, transactionResult, invitationResult, purchaseResult, settlementResult, contentResult] = queries
    const customerBalances = (ledgerResult.data || []).reduce((result, item) => {
      if (!item.customer_id) return result
      const amount = money(item.amount)
      const multiplier = item.type === "CUSTOMER_PURCHASE" ? -1 : 1
      result[item.customer_id] = (result[item.customer_id] || 0) + multiplier * amount
      return result
    }, {})
    const customers = (customerResult.data || []).map((item) => ({
      ...item, wallet: customerBalances[item.id] ?? money(item.wallet_balance), card: (cardResult.data || []).find((card) => card.customer_id === item.id && card.status === "ACTIVE")?.id || null,
    }))
    const ledger = ledgerResult.data || []
    const walletTotals = ledger.reduce((result, item) => {
      const amount = money(item.amount)
      if (item.type === "PURCHASE") result.purchased += amount
      if (item.type === "CUSTOMER_LOAD") result.distributed += amount
      if (item.type === "CUSTOMER_PURCHASE") result.collected += amount
      return result
    }, { ...emptyWallet })
    walletTotals.pendingSettlement = (settlementResult.data || []).filter((item) => item.status === "PENDING").reduce((sum, item) => sum + money(item.amount), 0)
    walletTotals.settled = (settlementResult.data || []).filter((item) => item.status === "APPROVED" || item.status === "SETTLED").reduce((sum, item) => sum + money(item.amount), 0)
    const customerName = (id) => customers.find((item) => item.id === id)?.name || "Unknown customer"
    setData({
      customers,
      products: (productResult.data || []).map((item) => ({ ...item, price: money(item.price), stock: Number(item.stock || 0) })),
      workstations: (workstationResult.data || []).map((item) => ({ ...item, rate: money(item.rate) })),
      cards: (cardResult.data || []).map((item) => ({ ...item, customer: item.customer_id ? customerName(item.customer_id) : "-" })),
      transactions: (transactionResult.data || []).map((item) => ({ ...item, customer: customerName(item.customer_id), card: item.card_id || "-", workstation: item.workstation_id || "-", date: displayDate(item.created_at), amount: money(item.amount) })),
      staff: (invitationResult.data || []).map((item) => ({ ...item, name: item.email, email: item.email, invitation_status: item.status })),
      purchaseRequests: (purchaseResult.data || []).map((item) => ({ ...item, amount: money(item.amount) })),
      settlementRequests: (settlementResult.data || []).map((item) => ({ ...item, amount: money(item.amount) })),
      activities: (contentResult.data || []).map((item) => ({
        ...item,
        contentId: item.content_id || item.id,
        description: item.description || item.content || "",
        startDate: item.start_date || "",
        endDate: item.end_date || "",
        mediaUrl: item.media_url || "",
        callToAction: item.call_to_action || "",
        date: displayDate(item.created_at),
      })),
    })
    setWallet(walletTotals)
    setDataLoading(false)
  }, [business])

  useEffect(() => {
    const refresh = setTimeout(() => loadData(), 0)
    return () => clearTimeout(refresh)
  }, [loadData])

  const mutate = useCallback(async (table, payload, options = {}) => {
    if (!business?.id) return false
    const query = supabase.from(table)
    const insertPayload = ["wallet_ledger", "business_transactions", "business_invitations", "content_items", "purchase_requests", "settlement_requests"].includes(table)
      ? { ...payload, business_id: business.id, created_by: user?.id }
      : { ...payload, business_id: business.id }
    const result = options.update
      ? await query.update(payload).eq("business_id", business.id).eq(options.column || "id", options.id)
      : await query.insert(insertPayload)
    if (result.error) {
      setDataError(result.error.message)
      return false
    }
    await loadData()
    return true
  }, [business, loadData, user])

  const update = (table, id, values) => mutate(table, values, { update: true, id })
  const addCustomer = (values) => mutate("customers", { id: values.id?.trim() || idFor("CUS"), name: values.name, email: values.email })
  const updateCustomerStatus = (id, status) => update("customers", id, { status })
  const addProduct = (values) => mutate("products_services", { id: values.id, name: values.name, description: values.description, category: values.category, price: values.price })
  const updateProductStatus = (id, status) => update("products_services", id, { status })
  const addWorkstation = (values) => mutate("workstations", values)
  const updateWorkstationStatus = (id, status) => update("workstations", id, { status })
  const addCard = (values) => mutate("nfc_cards", { id: values.id, customer_id: values.customerId, status: values.status || "ACTIVE" })
  const updateCardStatus = (id, status) => update("nfc_cards", id, { status })
  const replaceCard = async (oldId, newId) => {
    if (!business?.id) return false
    const oldCard = data.cards.find((card) => card.id === oldId)
    const result = await supabase.from("nfc_cards").insert({ id: newId, business_id: business.id, customer_id: oldCard?.customer_id || null, status: "ACTIVE" })
    if (result.error) return false
    await update("nfc_cards", oldId, { status: "REPLACED", replaced_by: newId })
    return true
  }
  const loadPoints = (customerId, amount) => mutate("wallet_ledger", { customer_id: customerId, type: "CUSTOMER_LOAD", amount, status: "COMPLETED" })
  const purchase = (values) => mutate("business_transactions", { ...values, type: values.type || "CUSTOMER_PURCHASE", status: "COMPLETED" })
  const refund = (item) => mutate("business_transactions", { customer_id: data.customers.find((customer) => customer.name === item.customer)?.id, type: "REFUND", amount: item.amount, status: "COMPLETED", metadata: { original_transaction_id: item.id } })
  const addActivity = (titleOrItem, content, contentId) => {
    const item = typeof titleOrItem === "object"
      ? titleOrItem
      : { title: titleOrItem, description: content, contentId, type: "UPDATE" }
    return mutate("content_items", {
      content_id: item.contentId,
      title: item.title,
      description: item.description,
      content: item.description,
      type: item.type || "UPDATE",
      start_date: item.startDate || null,
      end_date: item.endDate || null,
      media_url: item.mediaUrl || null,
      call_to_action: item.callToAction || null,
      status: item.status || "DRAFT",
    }, { update: Boolean(item.id), id: item.id })
  }
  const addStaff = (values) => mutate("business_invitations", { email: values.email, role: values.role || "STAFF" })
  const updateStaffStatus = (id, status) => update("business_invitations", id, { status })
  const purchaseInventory = async (productId, quantity, note) => {
    const product = data.products.find((item) => item.id === productId)
    if (!product || product.stock < quantity) return false
    const saved = await mutate("business_transactions", {
      type: "INVENTORY_PURCHASE",
      amount: money(quantity),
      status: "COMPLETED",
      metadata: { product_id: productId, note },
    })
    if (!saved) return false
    return Boolean(await update("products_services", productId, { stock: product.stock - quantity }))
  }
  const requestPurchase = (values) => mutate("purchase_requests", { amount: values.amount, reference: values.reference, notes: values.notes })
  const requestSettlement = (values) => mutate("settlement_requests", { amount: values.amount, notes: values.notes })
  const authenticateStaff = async (customerId) => data.customers.find((item) => item.id === customerId && item.status === "ACTIVE") || null

  return (
    <BusinessContext.Provider value={{
      user, profile, memberships, activeMemberships, currentMembership, business, businessRole,
      isAuthenticated, authLoading, authError, dataLoading, dataError, refreshBusinessData: loadData,
      ...data, wallet, authenticateStaff, loadPoints, purchase, refund, addActivity, addCustomer,
      updateCustomerStatus, addCard, replaceCard, updateCardStatus, addProduct, updateProductStatus,
      addWorkstation, updateWorkstationStatus, addStaff, updateStaffStatus, purchaseInventory,
      requestPurchase, requestSettlement,
    }}>
      {children}
    </BusinessContext.Provider>
  )
}
