import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import { getSupabase } from "@/lib/supabase"

/**
 * Server-side gate. Call from any page or server action that requires beta access.
 *
 * Behavior:
 *   - Not signed in → /sign-in
 *   - access_status = 'approved' → returns the user
 *   - Otherwise → syncs from access_requests (in case admin just approved) and
 *     redirects to /pending-approval if still not approved
 */
export async function requireApproved() {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const supabase = getSupabase()
  const email = user.emailAddresses[0]?.emailAddress.toLowerCase()

  // Read current profile status
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("access_status")
    .eq("clerk_user_id", user.id)
    .single()

  if (profile?.access_status === "approved") return user

  // Sync from access_requests in case admin approved after the profile was made
  if (email) {
    const { data: req } = await supabase
      .from("access_requests")
      .select("status")
      .eq("email", email)
      .single()

    if (req?.status === "approved") {
      await supabase
        .from("user_profiles")
        .upsert(
          {
            clerk_user_id: user.id,
            access_status: "approved",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "clerk_user_id" }
        )
      return user
    }

    // Ensure a pending row exists in access_requests so admin sees this signup
    if (!req) {
      await supabase.from("access_requests").upsert(
        {
          email,
          name: user.firstName ?? user.fullName ?? email,
          source: "signup",
          status: "pending",
        },
        { onConflict: "email" }
      )
    }

    // Mirror status onto profile (creates it if needed)
    await supabase.from("user_profiles").upsert(
      {
        clerk_user_id: user.id,
        access_status: req?.status ?? "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    )
  }

  redirect("/pending-approval")
}

/**
 * For API routes — returns null if approved, or a 403 NextResponse if not.
 * Usage:
 *   const blocked = await assertApproved()
 *   if (blocked) return blocked
 */
export async function assertApproved() {
  const user = await currentUser()
  if (!user) {
    const { NextResponse } = await import("next/server")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("access_status")
    .eq("clerk_user_id", user.id)
    .single()

  if (profile?.access_status !== "approved") {
    const { NextResponse } = await import("next/server")
    return NextResponse.json({ error: "Beta access required" }, { status: 403 })
  }

  return null
}
