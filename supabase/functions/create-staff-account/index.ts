import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const allowedRoles = new Set(["MANAGER", "STAFF", "CASHIER"])

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
      return response({ error: "Staff account provisioning is not configured." }, 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: callerData, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !callerData.user) return response({ error: "Invalid session." }, 401)

    const input = await request.json()
    const name = String(input.name || "").trim()
    const email = String(input.email || "").trim().toLowerCase()
    const phone = String(input.phone || "").trim()
    const password = String(input.password || "")
    const role = String(input.role || "STAFF").toUpperCase()
    const businessId = String(input.businessId || "")

    if (!name || !email || !phone || !password || !businessId) {
      return response({ error: "Name, email, phone, password, and business are required." }, 400)
    }
    if (!allowedRoles.has(role)) return response({ error: "That staff role is not allowed." }, 400)
    if (password.length < 8) return response({ error: "Password must be at least 8 characters." }, 400)

    const { data: ownerMembership, error: membershipError } = await admin
      .from("business_members")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", callerData.user.id)
      .eq("role", "OWNER")
      .eq("status", "ACTIVE")
      .maybeSingle()

    if (membershipError || !ownerMembership) return response({ error: "Only an active business owner can add staff." }, 403)

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, phone },
    })
    if (authError || !authData.user) return response({ error: authError?.message || "Unable to create staff login." }, 400)

    const userId = authData.user.id
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      full_name: name,
      email,
      phone,
      role: "BUSINESS_OWNER",
      status: "ACTIVE",
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(userId)
      return response({ error: profileError.message }, 400)
    }

    const { error: memberError } = await admin.from("business_members").insert({
      business_id: businessId,
      user_id: userId,
      role,
      status: "ACTIVE",
      invitation_status: "ACCEPTED",
    })
    if (memberError) {
      await admin.from("profiles").delete().eq("id", userId)
      await admin.auth.admin.deleteUser(userId)
      return response({ error: memberError.message }, 400)
    }

    const { error: invitationError } = await admin.from("business_invitations").insert({
      business_id: businessId,
      name,
      email,
      role,
      status: "ACTIVE",
      invited_by: callerData.user.id,
    })
    if (invitationError) {
      await admin.from("business_members").delete().eq("business_id", businessId).eq("user_id", userId)
      await admin.from("profiles").delete().eq("id", userId)
      await admin.auth.admin.deleteUser(userId)
      return response({ error: invitationError.message }, 400)
    }

    return response({ success: true, userId })
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Unable to create staff account." }, 500)
  }
})
