const PROFILE_ROLE_FOR_MEMBERSHIP = {
  OWNER: "BUSINESS_OWNER",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  STAFF: "STAFF",
}

// A global profile role must agree with the selected business membership.
// Membership checks still determine tenant access; profile roles never grant it.
export function matchingBusinessMemberships(profile, memberships) {
  if (profile?.status !== "ACTIVE") return []
  return (memberships || []).filter(member =>
    member.status === "ACTIVE"
    && member.businesses
    && PROFILE_ROLE_FOR_MEMBERSHIP[member.role]
    && PROFILE_ROLE_FOR_MEMBERSHIP[member.role] === profile.role,
  )
}
