import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { CountryCode, Products } from "plaid"

export const dynamic = "force-dynamic"

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Canadian banks (RBC especially) enforce the strict OAuth redirect
  // handshake. Plaid requires the redirect_uri to be REGISTERED in the
  // dashboard under "Allowed redirect URIs" AND passed at link-token
  // create time. We derive it from NEXT_PUBLIC_APP_URL so it tracks
  // whatever production domain the worker is deployed to.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  const redirectUri = appUrl ? `${appUrl}/dashboard?plaid-oauth=1` : undefined

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Aurora AI",
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: "en",
      // Only set redirect_uri when running outside sandbox — the sandbox
      // institutions don't require it, and setting it forces a CSP that
      // breaks local dev.
      ...(redirectUri && process.env.PLAID_ENV !== "sandbox" ? { redirect_uri: redirectUri } : {}),
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (err) {
    // Scrub: never log the full error payload (Plaid responses can include
    // sensitive client IDs / partial secrets in some error shapes).
    const safeMessage =
      err instanceof Error ? err.message.slice(0, 200) : "Unknown Plaid error"
    console.error("[plaid] linkTokenCreate failed:", safeMessage)
    return NextResponse.json(
      { error: "Could not initialize bank link. Try again in a moment." },
      { status: 500 }
    )
  }
}
