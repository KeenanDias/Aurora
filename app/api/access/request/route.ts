import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.LANDING_PAGE_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders })
}

export async function POST(req: Request) {
  let body: { email?: string; name?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const name = body.name?.trim()

  if (!email || !EMAIL_REGEX.test(email)) {
    return json({ error: "Please enter a valid email." }, 400)
  }
  if (!name || name.length < 1 || name.length > 100) {
    return json({ error: "Please enter your name." }, 400)
  }

  const supabase = getSupabase()

  const { data: existing } = await supabase
    .from("access_requests")
    .select("status")
    .eq("email", email)
    .single()

  if (existing) {
    if (existing.status === "approved") {
      return json({
        ok: true,
        status: "approved",
        message: "You're already approved! Sign in to continue.",
      })
    }
    return json({
      ok: true,
      status: existing.status,
      message: "You're already on the list. We'll be in touch shortly.",
    })
  }

  const { error } = await supabase.from("access_requests").insert({
    email,
    name,
    source: body.source ?? "landing",
    status: "pending",
  })

  if (error) {
    console.error("access_requests insert error:", error)
    return json({ error: "Something went wrong. Please try again." }, 500)
  }

  return json({
    ok: true,
    status: "pending",
    message: "Thanks! We'll email you when you're approved.",
  })
}

// CORS preflight — allows the external Vercel landing page to POST here
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
