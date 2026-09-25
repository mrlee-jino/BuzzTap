import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authorization = request.headers.get("Authorization")
    const token = authorization?.replace("Bearer ", "")
    if (!token) return response({ error: "Authentication is required." }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return response({ error: "Staff account deletion is not configured." }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: callerData, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !callerData.user) return response({ error: "Invalid session." }, 401)

    const input = await request.json()
    const businessId = String(input.businessId || "")
    const memberId = String(input.memberId || "")
    if (!businessId || !memberId) return response({ error: "Business and member are required." }, 400)

    const { data: ownerMembership, error: ownerError } = await admin
      .from("business_members")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", callerData.user.id)
      .eq("role", "OWNER")
      .eq("status", "ACTIVE")
      .maybeSingle()
    if (ownerError || !ownerMembership) return response({ error: "Only an active business owner can delete staff accounts." }, 403)

    const { data: invitation, error: invitationError } = await admin
      .from("business_invitations")
      .select("id, email, role, status")
      .eq("business_id", businessId)
      .eq("id", memberId)
      .maybeSingle()
    if (invitationError || !invitation) return response({ error: "Staff account was not found." }, 404)
    if (invitation.role === "OWNER") return response({ error: "The business owner account cannot be deleted." }, 400)
    if (invitation.status !== "SUSPENDED") return response({ error: "Only suspended staff accounts can be deleted." }, 400)

    const { data: targetProfile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", invitation.email)
      .maybeSingle()
    if (profileError) return response({ error: profileError.message }, 400)

    const { data: member, error: memberError } = targetProfile
      ? await admin
        .from("business_members")
        .select("user_id")
        .eq("business_id", businessId)
        .eq("user_id", targetProfile.id)
        .maybeSingle()
      : { data: null, error: null }
    if (memberError) return response({ error: memberError.message }, 400)

    const targetUserId = member?.user_id
    if (targetUserId) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(targetUserId)
      if (deleteUserError) return response({ error: deleteUserError.message }, 400)
    }

    const { error: deleteInvitationError } = await admin
      .from("business_invitations")
      .delete()
      .eq("id", invitation.id)
      .eq("business_id", businessId)
    if (deleteInvitationError) return response({ error: deleteInvitationError.message }, 400)

    return response({ success: true })
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Unable to delete staff account." }, 500)
  }
})
