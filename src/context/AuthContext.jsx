import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { AuthContext } from "./AuthContextValue"

async function recordAccessEvents(userId, memberships, event) {
  const rows = (memberships || [])
    .filter((membership) => membership.business_id)
    .map((membership) => ({
      business_id: membership.business_id,
      user_id: userId,
      event,
    }))

  if (rows.length) {
    await supabase.from("business_access_logs").insert(rows)
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadUserData(authUser) {
    if (!authUser) {
      setUser(null)
      setProfile(null)
      setMemberships([])

      return {
        profile: null,
        memberships: [],
      }
    }

    setUser(authUser)

    // Load the user's profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        phone,
        role,
        status,
        created_at,
        updated_at
      `)
      .eq("id", authUser.id)
      .single()

    if (profileError) {
      console.error("Failed to load profile:", profileError)

      setError(profileError.message)
      setProfile(null)
      setMemberships([])

      return {
        profile: null,
        memberships: [],
        error: profileError,
      }
    }

    setProfile(profileData)

    // Load the businesses this user belongs to
    const { data: membershipData, error: membershipError } = await supabase
      .from("business_members")
      .select(`
        id,
        business_id,
        user_id,
        role,
        status,
        invitation_status,
        created_at,
        updated_at,
        businesses (
          id,
          name,
          business_type,
          email,
          phone,
          address,
          status
        )
      `)
      .eq("user_id", authUser.id)
      .eq("status", "ACTIVE")

    if (membershipError) {
      console.error("Failed to load business memberships:", membershipError)

      setError(membershipError.message)
      setMemberships([])

      return {
        profile: profileData,
        memberships: [],
        error: membershipError,
      }
    }

    const activeMemberships = membershipData || []

    setMemberships(activeMemberships)

    return {
      profile: profileData,
      memberships: activeMemberships,
      error: null,
    }
  }

  useEffect(() => {
    let mounted = true

    async function initializeAuth() {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        console.error("Failed to get Supabase session:", sessionError)
        setError(sessionError.message)
      }

      setSession(currentSession)

      const result = await loadUserData(currentSession?.user || null)

      if (!mounted) return

      if (result.error) {
        setError(result.error.message)
      } else if (currentSession?.user) {
        await recordAccessEvents(
          currentSession.user.id,
          result.memberships,
          "LOGIN",
        )
      }

      setLoading(false)
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return

      setSession(newSession)
      setUser(newSession?.user || null)

      if (!newSession) {
        setProfile(null)
        setMemberships([])
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    setError(null)

    const {
      data,
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(signInError.message)

      return {
        success: false,
        error: signInError,
      }
    }

    const result = await loadUserData(data.user)

    if (result.error) {
      return {
        success: false,
        error: result.error,
        user: data.user,
        profile: result.profile,
        memberships: result.memberships,
      }
    }

    await recordAccessEvents(data.user.id, result.memberships, "LOGIN")

    return {
      success: true,
      user: data.user,
      profile: result.profile,
      memberships: result.memberships,
    }
  }

  async function registerBusiness({
    businessName,
    email,
    password,
    businessType,
    phone,
    address,
  }) {
    setError(null)

    const {
      data: signUpData,
      error: signUpError,
    } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          business_name: businessName.trim(),
          business_type: businessType,
          phone: phone.trim(),
          address: address.trim(),
        },
      },
    })

    if (signUpError || !signUpData.user) {
      const error = signUpError || new Error("Unable to create the account.")
      console.error("Failed to create the Auth user:", error)
      setError(error.message)

      return { success: false, error }
    }

    if (signUpData.session) {
      await supabase.auth.signOut()
    }

    return {
      success: true,
      requiresEmailConfirmation: !signUpData.session,
    }
  }

  async function signOut() {
    setError(null)

    await recordAccessEvents(user?.id, memberships, "LOGOUT")

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)

      return {
        success: false,
        error: signOutError,
      }
    }

    setSession(null)
    setUser(null)
    setProfile(null)
    setMemberships([])

    return {
      success: true,
    }
  }

  async function changePassword(password) {
    setError(null)

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    })

    if (passwordError) {
      setError(passwordError.message)
      return { success: false, error: passwordError }
    }

    return { success: true }
  }

  async function refreshUserData() {
    if (!user) return null

    setError(null)

    const result = await loadUserData(user)

    if (result.error) {
      setError(result.error.message)
    }

    return result
  }

  const value = {
    session,
    user,
    profile,
    memberships,
    loading,
    error,
    signIn,
    registerBusiness,
    signOut,
    changePassword,
    refreshUserData,
    isAuthenticated: !!session,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
