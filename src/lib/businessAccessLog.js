export async function recordBusinessAccess(client, userId, memberships, event, accessToken) {
  if (!userId) return
  const businessIds = [...new Set((memberships || [])
    .filter((membership) => membership.status === "ACTIVE" && membership.business_id)
    .map((membership) => membership.business_id))]
  if (!businessIds.length) return

  try {
    const query = client.from("business_access_logs").insert(businessIds.map((businessId) => ({
      business_id: businessId, user_id: userId, event,
    })))
    // signOut clears the SDK session. Use the departing user's token only for
    // this final audit request, which remains subject to the existing RLS.
    const result = await (accessToken ? query.setHeader("Authorization", `Bearer ${accessToken}`) : query)
    if (result.error) console.warn("Business access event could not be saved.")
  } catch {
    // Audit connectivity must not prevent an account from signing out.
    console.warn("Business access event could not be saved.")
  }
}

export async function signOutWithBusinessAccess(client, session, memberships) {
  const { error } = await client.auth.signOut()
  if (!error && session?.access_token) {
    await recordBusinessAccess(client, session.user?.id, memberships, "LOGOUT", session.access_token)
  }
  return { error }
}
