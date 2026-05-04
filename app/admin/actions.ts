"use server"

import { revalidatePath } from "next/cache"
import { clerkClient } from "@clerk/nextjs/server"
import { getSupabase } from "@/lib/supabase"
import { isAdmin, getAdminEmail } from "@/lib/admin"
import { sendApprovalEmail, sendDenialEmail } from "@/lib/email"

async function syncProfileAccessStatus(email: string, status: "approved" | "denied" | "pending") {
  // Find Clerk user by email and update their user_profiles.access_status if a profile exists.
  try {
    const client = await clerkClient()
    const { data: users } = await client.users.getUserList({ emailAddress: [email] })
    if (!users.length) return // no Clerk account yet — they'll be synced on signup

    for (const u of users) {
      await getSupabase()
        .from("user_profiles")
        .update({ access_status: status, updated_at: new Date().toISOString() })
        .eq("clerk_user_id", u.id)
    }
  } catch (err) {
    console.error("[admin] syncProfileAccessStatus failed:", err)
    // non-fatal — access_requests is the source of truth, profile is just a mirror
  }
}

export async function approveRequest(id: string) {
  if (!(await isAdmin())) return { error: "Unauthorized" }

  const adminEmail = await getAdminEmail()
  const supabase = getSupabase()

  const { data: request, error: fetchErr } = await supabase
    .from("access_requests")
    .select("email, name, status")
    .eq("id", id)
    .single()

  if (fetchErr || !request) return { error: "Request not found" }

  const { error: updateErr } = await supabase
    .from("access_requests")
    .update({
      status: "approved",
      decided_at: new Date().toISOString(),
      decided_by: adminEmail,
    })
    .eq("id", id)

  if (updateErr) return { error: updateErr.message }

  await syncProfileAccessStatus(request.email, "approved")

  // Send approval email
  const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://aurora.app"}/sign-in`
  const emailResult = await sendApprovalEmail({
    to: request.email,
    name: request.name,
    signInUrl,
  })

  if (emailResult.ok) {
    await supabase
      .from("access_requests")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", id)
  }

  revalidatePath("/admin")
  return { success: true, emailSent: emailResult.ok, emailError: emailResult.error }
}

export async function denyRequest(id: string) {
  if (!(await isAdmin())) return { error: "Unauthorized" }

  const adminEmail = await getAdminEmail()
  const supabase = getSupabase()

  const { data: request, error: fetchErr } = await supabase
    .from("access_requests")
    .select("email, name")
    .eq("id", id)
    .single()

  if (fetchErr || !request) return { error: "Request not found" }

  const { error: updateErr } = await supabase
    .from("access_requests")
    .update({
      status: "denied",
      decided_at: new Date().toISOString(),
      decided_by: adminEmail,
    })
    .eq("id", id)

  if (updateErr) return { error: updateErr.message }

  await syncProfileAccessStatus(request.email, "denied")
  await sendDenialEmail({ to: request.email, name: request.name })

  revalidatePath("/admin")
  return { success: true }
}

export async function resetRequest(id: string) {
  if (!(await isAdmin())) return { error: "Unauthorized" }

  const supabase = getSupabase()
  const { data: request } = await supabase
    .from("access_requests")
    .select("email")
    .eq("id", id)
    .single()

  const { error } = await supabase
    .from("access_requests")
    .update({
      status: "pending",
      decided_at: null,
      decided_by: null,
      notified_at: null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  if (request?.email) {
    await syncProfileAccessStatus(request.email, "pending")
  }

  revalidatePath("/admin")
  return { success: true }
}

export async function manuallyAddRequest(name: string, email: string) {
  if (!(await isAdmin())) return { error: "Unauthorized" }

  const cleaned = email.trim().toLowerCase()
  const cleanedName = name.trim()
  if (!cleaned || !cleanedName) return { error: "Name and email required" }

  const supabase = getSupabase()
  const { error } = await supabase.from("access_requests").upsert(
    { email: cleaned, name: cleanedName, source: "manual", status: "pending" },
    { onConflict: "email" }
  )

  if (error) return { error: error.message }

  revalidatePath("/admin")
  return { success: true }
}
