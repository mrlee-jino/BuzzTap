import { useCallback, useEffect, useMemo, useState } from "react"

import { supabase } from "./lib/supabaseClient"
import { BusinessContext } from "./businessContext"
import { useAuth } from "./context/useAuth"

const emptyWallet = { purchased: 0, distributed: 0, collected: 0, pendingSettlement: 0, settled: 0 }
const defaultNotifications = {
  transactionAlerts: true,
  settlementUpdates: true,
  contentModeration: true,
  lowPointInventory: true,
}
const emptyData = {
  customers: [],
  transactions: [],
  activities: [],
  purchaseRequests: [],
  settlementRequests: [],
  cards: [],
  products: [],
  workstations: [],
  workstationSessions: [],
  inventoryMovements: [],
  ledger: [],
  staff: [],
  accessLogs: [],
  notificationPreferences: defaultNotifications,
}

const money = (value) => Number(value || 0)
const displayDate = (value) => value ? new Date(value).toLocaleString() : ""
const idFor = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`

const functionErrorMessage = async (error, data, fallback) => {
  if (data?.error) return data.error

  if (error?.context) {
    try {
      const body = await error.context.json()
      if (body?.error) return body.error
    } catch {
      // Keep the SDK error when the response is not JSON.
    }
  }

  return error?.message || fallback
}

export function BusinessProvider({ children, selectedMembership }) {
  const { user, profile, memberships, loading: authLoading, error: authError, isAuthenticated, refreshUserData } = useAuth()
  const [data, setData] = useState(emptyData)
  const [wallet, setWallet] = useState(emptyWallet)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState(null)

  const activeMemberships = useMemo(
    () => (memberships || []).filter((item) => item.status === "ACTIVE" && item.businesses),
    [memberships],
  )
  const currentMembership = useMemo(
    () => activeMemberships.find((item) => item.id === selectedMembership?.id)
      || (activeMemberships.length === 1 ? activeMemberships[0] : null),
    [activeMemberships, selectedMembership],
  )
  const business = currentMembership?.businesses || null
  const businessRole = currentMembership?.role || null

  const loadData = useCallback(async () => {
    if (!business?.id) {
      setData(emptyData)
      setWallet(emptyWallet)
      setDataError(null)
      setDataLoading(false)
      return
    }
    setDataLoading(true)
    setDataError(null)
    setData(emptyData)
    setWallet(emptyWallet)
    const bid = business.id
    try {
      const queries = await Promise.all([
        supabase.from("customers").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("products_services").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("workstations").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("nfc_cards").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("wallet_ledger").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("business_transactions").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("business_invitations").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("business_access_logs").select("*").eq("business_id", bid).order("occurred_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("purchase_requests").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("settlement_requests").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("content_items").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("workstation_sessions").select("*").eq("business_id", bid).order("started_at", { ascending: false }),
        supabase.from("product_inventory_movements").select("*").eq("business_id", bid).order("created_at", { ascending: false }),
        supabase.from("business_preferences").select("notifications").eq("business_id", bid).maybeSingle(),
      ])
      const failure = queries.find((result) => result.error)
      if (failure) {
        setDataError(failure.error.message)
        return
      }
      const [
        customerResult, productResult, workstationResult, cardResult,
        ledgerResult, transactionResult, invitationResult, accessLogResult,
        profileResult, purchaseResult, settlementResult, contentResult,
        sessionResult, movementResult, preferencesResult,
      ] = queries
      const ledger = ledgerResult.data || []
      const completedLedger = ledger.filter((item) => String(item.status || "").toUpperCase() === "COMPLETED")
      const customerBalances = completedLedger.reduce((result, item) => {
        if (!item.customer_id) return result
        const amount = money(item.amount)
        const multiplier = item.type === "CUSTOMER_PURCHASE" ? -1 : 1
        result[item.customer_id] = (result[item.customer_id] || 0) + multiplier * amount
        return result
      }, {})
      const customers = (customerResult.data || []).map((item) => ({
        ...item,
        wallet: customerBalances[item.id] ?? money(item.wallet_balance),
        card: (cardResult.data || []).find((card) => card.customer_id === item.id && card.status === "ACTIVE")?.id || null,
      }))
      const walletTotals = completedLedger.reduce((result, item) => {
        const amount = money(item.amount)
        if (item.type === "PURCHASE") result.purchased += amount
        if (item.type === "CUSTOMER_LOAD") result.distributed += amount
        if (item.type === "CUSTOMER_PURCHASE") result.collected += amount
        return result
      }, { ...emptyWallet })
      walletTotals.purchased += (purchaseResult.data || [])
        .filter((item) => String(item.status || "").toUpperCase() === "APPROVED")
        .reduce((sum, item) => sum + money(item.amount), 0)
      walletTotals.pendingSettlement = (settlementResult.data || []).filter((item) => item.status === "PENDING").reduce((sum, item) => sum + money(item.amount), 0)
      walletTotals.settled = (settlementResult.data || []).filter((item) => item.status === "APPROVED" || item.status === "SETTLED").reduce((sum, item) => sum + money(item.amount), 0)
      const customerName = (id) => customers.find((item) => item.id === id)?.name || "Unknown customer"
      const profileById = (profileResult.data || []).reduce((result, item) => {
        result[item.id] = item
        return result
      }, {})
      setData({
        customers,
        products: (productResult.data || []).map((item) => ({ ...item, price: money(item.price), stock: Number(item.stock || 0) })),
        workstations: (workstationResult.data || []).map((item) => ({ ...item, rate: money(item.rate) })),
        workstationSessions: sessionResult.data || [],
        inventoryMovements: (movementResult.data || []).map((item) => ({
          ...item,
          productName: (productResult.data || []).find((product) => product.id === item.product_id)?.name || item.product_id,
          operatorName: profileById[item.created_by]?.full_name || profileById[item.created_by]?.email || "Unknown member",
        })),
        ledger,
        cards: (cardResult.data || []).map((item) => ({ ...item, customer: item.customer_id ? customerName(item.customer_id) : "-" })),
        transactions: (transactionResult.data || []).map((item) => ({ ...item, customer: customerName(item.customer_id), card: item.card_id || "-", workstation: item.workstation_id || "-", operatorName: profileById[item.created_by]?.full_name || profileById[item.created_by]?.email || "Unknown member", date: displayDate(item.created_at), amount: money(item.amount) })),
        staff: (invitationResult.data || []).map((item) => ({ ...item, name: item.name || item.email, email: item.email, invitation_status: item.status })),
        accessLogs: (accessLogResult.data || []).map((item) => ({ ...item, userEmail: profileById[item.user_id]?.email || "Unknown member", date: displayDate(item.occurred_at) })),
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
        notificationPreferences: { ...defaultNotifications, ...(preferencesResult.data?.notifications || {}) },
      })
      setWallet(walletTotals)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Business data could not be loaded.")
    } finally {
      setDataLoading(false)
    }
  }, [business])

  useEffect(() => {
    const refresh = setTimeout(() => loadData(), 0)
    return () => clearTimeout(refresh)
  }, [loadData])

  const mutate = useCallback(async (table, payload, options = {}) => {
    if (!business?.id) {
      setDataError("No active business is available.")
      return false
    }
    const query = supabase.from(table)
    const insertPayload = ["wallet_ledger", "business_transactions", "content_items", "purchase_requests", "settlement_requests"].includes(table)
      ? { ...payload, business_id: business.id, created_by: user?.id }
      : table === "business_invitations"
        ? { ...payload, business_id: business.id, invited_by: user?.id }
      : { ...payload, business_id: business.id }
    const result = options.update
      ? await query.update(payload).eq("business_id", business.id).eq(options.column || "id", options.id).select("id")
      : await query.insert(insertPayload).select("id")
    if (result.error) {
      setDataError(result.error.message)
      return false
    }
    if (!result.data?.length) {
      setDataError("No record was changed. It may not exist or you may not have permission.")
      return false
    }
    await loadData()
    return true
  }, [business, loadData, user])

  const update = (table, id, values) => mutate(table, values, { update: true, id })
  const addCustomer = (values) => mutate("customers", { id: values.id?.trim() || idFor("CUS"), name: values.name, email: values.email })
  const updateCustomerStatus = (id, status) => update("customers", id, { status })
  const addProduct = (values) => mutate("products_services", { id: values.id, name: values.name, description: values.description, category: values.category, price: values.price, stock: values.stock })
  const updateProductStatus = (id, status) => update("products_services", id, { status })
  const addWorkstation = (values) => mutate("workstations", values)
  const updateWorkstationStatus = (id, status) => update("workstations", id, { status })
  const addCard = (values) => mutate("nfc_cards", { id: values.id, customer_id: values.customerId, status: values.status || "ACTIVE" })
  const updateCardStatus = (id, status) => update("nfc_cards", id, { status })
  const assignCard = async (customerId, cardId, oldCardId = null) => {
    if (!business?.id) return { success: false, error: "No active business is available." }
    const { error } = await supabase.rpc("assign_nfc_card", {
      p_business_id: business.id,
      p_customer_id: customerId,
      p_card_id: cardId,
      p_old_card_id: oldCardId,
    })
    if (error) {
      setDataError(error.message)
      return { success: false, error: error.message }
    }
    await loadData()
    return { success: true }
  }
  const replaceCard = async (oldId, newId) => {
    const oldCard = data.cards.find((card) => card.id === oldId)
    if (!oldCard?.customer_id) return false
    return (await assignCard(oldCard.customer_id, newId, oldId)).success
  }
  const loadPoints = async (customerId, amount) => {
    if (!business?.id) return false
    const { error } = await supabase.rpc("load_customer_points", {
      p_business_id: business.id,
      p_customer_id: customerId,
      p_amount: amount,
    })
    if (error) {
      setDataError(error.message)
      return false
    }
    await loadData()
    return true
  }
  const purchase = (values) => mutate("business_transactions", { ...values, type: values.type || "CUSTOMER_PURCHASE", status: "COMPLETED" })
  const refund = async (item) => {
    if (!business?.id) return { success: false, error: "No active business is available." }
    const { data: refundId, error } = await supabase.rpc("record_business_refund", {
      p_business_id: business.id,
      p_transaction_id: item.id,
    })
    if (error) {
      setDataError(error.message)
      return { success: false, error: error.message }
    }
    await loadData()
    return { success: true, id: refundId }
  }
  const addActivity = (titleOrItem, content, contentId) => {
    const item = typeof titleOrItem === "object"
      ? titleOrItem
      : { title: titleOrItem, description: content, contentId, type: "UPDATE" }
    if (!business?.id) {
      return Promise.resolve({ success: false, error: "No active business is available." })
    }
    const payload = {
      content_id: item.contentId,
      title: item.title,
      description: item.description,
      content: item.content || item.description,
      type: item.type || "UPDATE",
      start_date: item.startDate || null,
      end_date: item.endDate || null,
      media_url: item.mediaUrl || null,
      call_to_action: item.callToAction || null,
      status: item.status || "DRAFT",
    }
    const saveContent = async () => {
      let result
      try {
        result = item.id
          ? await supabase.from("content_items")
            .update(payload)
            .eq("business_id", business.id)
            .eq("id", item.id)
            .select("id")
            .maybeSingle()
          : await supabase.from("content_items")
            .insert({ ...payload, business_id: business.id, created_by: user?.id })
            .select("id")
            .single()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected database error while saving content."
        setDataError(message)
        return { success: false, error: message }
      }

      if (result.error) {
        setDataError(result.error.message)
        return { success: false, error: result.error.message }
      }
      if (!result.data) {
        const message = "Content was not found or you do not have permission to change it."
        setDataError(message)
        return { success: false, error: message }
      }

      await loadData()
      return { success: true, id: result.data.id }
    }
    return saveContent()
  }
  const addStaff = async (values) => {
    if (!business?.id) {
      return { success: false, error: "No active business is available." }
    }

    const { data, error } = await supabase.functions.invoke("create-staff-account", {
      body: {
        businessId: business.id,
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role || "STAFF",
      },
    })

    if (error || data?.error) {
      const message = await functionErrorMessage(error, data, "Unable to create staff account.")
      setDataError(message)
      return { success: false, error: message }
    }

    await loadData()
    return { success: true }
  }
  const updateStaffStatus = (id, status) => update("business_invitations", id, { status })
  const deleteStaff = async (memberId) => {
    if (!business?.id) {
      return { success: false, error: "No active business is available." }
    }

    const { data, error } = await supabase.functions.invoke("delete-staff-account", {
      body: { businessId: business.id, memberId },
    })
    if (error || data?.error) {
      const message = await functionErrorMessage(error, data, "Unable to delete staff account.")
      setDataError(message)
      return { success: false, error: message }
    }

    await loadData()
    return { success: true }
  }
  const purchaseInventory = async (productId, quantity, note) =>
    (await issueInventory(productId, quantity, note)).success
  const requestPurchase = (values) => mutate("purchase_requests", { amount: values.amount, reference: values.reference, notes: values.notes })
  const requestSettlement = (values) => mutate("settlement_requests", { amount: values.amount, notes: values.notes })
  const saveBusinessSettings = async (values) => {
    if (!business?.id) return { success: false, error: "No active business is available." }
    const { error } = await supabase.rpc("save_business_settings", {
      p_business_id: business.id,
      p_name: values.name,
      p_email: values.email,
      p_phone: values.phone,
      p_address: values.address,
      p_notifications: values.notifications,
    })
    if (error) {
      setDataError(error.message)
      return { success: false, error: error.message }
    }
    await refreshUserData()
    await loadData()
    return { success: true }
  }
  const changeWorkstationSession = async (workstationId, action) => {
    if (!business?.id) return { success: false, error: "No active business is available." }
    const { error } = await supabase.rpc(
      action === "START" ? "start_workstation_session" : "end_workstation_session",
      { p_business_id: business.id, p_workstation_id: workstationId },
    )
    if (error) {
      setDataError(error.message)
      return { success: false, error: error.message }
    }
    await loadData()
    return { success: true }
  }
  const issueInventory = async (productId, quantity, note) => {
    if (!business?.id) return { success: false, error: "No active business is available." }
    const { error } = await supabase.rpc("issue_product_inventory", {
      p_business_id: business.id,
      p_product_id: productId,
      p_quantity: quantity,
      p_note: note,
    })
    if (error) {
      setDataError(error.message)
      return { success: false, error: error.message }
    }
    await loadData()
    return { success: true }
  }
  const restockInventory = async (productId, quantity, note) => {
    if (!business?.id) return { success: false, error: "No active business is available." }
    const { error } = await supabase.rpc("restock_product_inventory", {
      p_business_id: business.id,
      p_product_id: productId,
      p_quantity: quantity,
      p_note: note,
    })
    if (error) {
      setDataError(error.message)
      return { success: false, error: error.message }
    }
    await loadData()
    return { success: true }
  }
  const authenticateStaff = async (customerId) => data.customers.find((item) => item.id === customerId && item.status === "ACTIVE") || null

  return (
    <BusinessContext.Provider value={{
      user, profile, memberships, activeMemberships, currentMembership, business, businessRole,
      isAuthenticated, authLoading, authError, dataLoading, dataError, refreshBusinessData: loadData,
      ...data, wallet, authenticateStaff, loadPoints, purchase, refund, addActivity, addCustomer,
      updateCustomerStatus, addCard, assignCard, replaceCard, updateCardStatus, addProduct, updateProductStatus,
      addWorkstation, updateWorkstationStatus, addStaff, updateStaffStatus, deleteStaff, purchaseInventory,
      requestPurchase, requestSettlement, saveBusinessSettings, changeWorkstationSession,
      issueInventory, restockInventory,
    }}>
      {children}
    </BusinessContext.Provider>
  )
}
