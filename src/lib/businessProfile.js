import { profileTheme } from "./profileTheme.js"

export async function savePublicBusinessProfile(client, businessId, profile) {
  const requestedColor = profileTheme(profile.theme_color).color
  const { error: saveError } = await client.rpc("save_public_business_profile", {
    p_business_id: businessId,
    p_profile: { ...profile, theme_color: requestedColor },
  })
  if (saveError) throw saveError

  // Verify the persisted value using the same read used after leaving the page.
  // Older save RPCs silently omit theme_color while reporting a successful save.
  const { data, error: readError } = await client.rpc("get_public_business_profile", {
    p_business_id: businessId,
  })
  if (readError) throw readError
  if (typeof data?.theme_color !== "string" || data.theme_color.toUpperCase() !== requestedColor) {
    throw new Error("Your theme color was not saved. Business profile saving needs an update. Please contact your administrator.")
  }
  return { ...data, theme_color: requestedColor }
}
