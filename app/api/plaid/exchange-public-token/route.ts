import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { plaidClient, fetchPlaidIdentity } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"
import { verifyAccountMatch } from "@/lib/verify-account-match"
import type { StatementIdentity } from "@/lib/parse-statement"

export const dynamic = "force-dynamic"

// Tag every server log with the route + a redacted user id so we can grep
// production logs without ever seeing access tokens or public tokens.
function logSafe(stage: string, userId: string, extra?: Record<string, unknown>) {
  const safeUid = userId.length > 8 ? `${userId.slice(0, 4)}…${userId.slice(-4)}` : userId
  const safeExtra: Record<string, unknown> = {}
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      // Never log token-shaped values. Always strip anything that looks
      // like an access_token / public_token / secret.
      if (/(access|public|secret|token)/i.test(k)) continue
      safeExtra[k] = typeof v === "string" ? v.slice(0, 80) : v
    }
  }
  console.log(`[plaid/exchange] ${stage}`, { uid: safeUid, ...safeExtra })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let public_token: string | undefined
  let force: boolean | undefined
  try {
    const body = await req.json()
    public_token = body.public_token
    force = body.force
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!public_token || typeof public_token !== "string") {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 })
  }

  // Exchange for permanent access token
  let response
  try {
    response = await plaidClient.itemPublicTokenExchange({ public_token })
  } catch (err) {
    const safeMessage =
      err instanceof Error ? err.message.slice(0, 200) : "Unknown Plaid error"
    logSafe("itemPublicTokenExchange failed", userId, { error: safeMessage })
    return NextResponse.json(
      { error: "Could not complete bank link. Please try again." },
      { status: 502 }
    )
  }

  const { access_token, item_id } = response.data
  logSafe("token exchanged", userId, { item_id })

  // Fetch institution + account identity data from Plaid
  let plaidIdentity
  try {
    plaidIdentity = await fetchPlaidIdentity(access_token)
  } catch (e) {
    console.error("Failed to fetch Plaid identity:", e)
    plaidIdentity = null
  }

  // Check existing vault statements for verification
  let verificationWarnings: string[] = []
  if (plaidIdentity) {
    const { data: vaultStatements } = await getSupabase()
      .from("vault_uploads")
      .select("id, institution_name, account_mask, transit_number, institution_number, filename, verification_status")
      .eq("clerk_user_id", userId)

    if (vaultStatements && vaultStatements.length > 0) {
      const primaryAccount = plaidIdentity.accounts[0]
      if (primaryAccount) {
        const plaidInfo = {
          institutionId: plaidIdentity.institutionId,
          institutionName: plaidIdentity.institutionName,
          accountMask: primaryAccount.mask,
          eftInstitution: primaryAccount.eftInstitution,
          eftBranch: primaryAccount.eftBranch,
        }

        for (const stmt of vaultStatements) {
          const stmtIdentity: StatementIdentity = {
            institutionName: stmt.institution_name,
            accountMask: stmt.account_mask,
            accountHolderName: null,
            transitNumber: stmt.transit_number,
            institutionNumber: stmt.institution_number,
          }

          // Skip if no identity data was extracted from this statement
          if (!stmtIdentity.institutionName && !stmtIdentity.accountMask) continue

          const result = verifyAccountMatch(stmtIdentity, plaidInfo)

          if (!result.matched && !force) {
            // Return mismatch as a warning — let the frontend ask for confirmation
            return NextResponse.json({
              success: false,
              mismatch: true,
              failures: result.failures,
              warnings: result.warnings,
              statementFilename: stmt.filename,
            }, { status: 409 })
          }

          // Matched — update verification status
          verificationWarnings.push(...result.warnings)
          await getSupabase()
            .from("vault_uploads")
            .update({
              verification_status: "verified",
              verification_details: JSON.stringify(result),
            })
            .eq("id", stmt.id)
        }
      }
    }
  }

  // Save to user profile (with identity data for future statement verification)
  const profileUpdate: Record<string, unknown> = {
    plaid_access_token: access_token,
    plaid_item_id: item_id,
    bank_linked: true,
    updated_at: new Date().toISOString(),
  }

  if (plaidIdentity) {
    profileUpdate.plaid_institution_id = plaidIdentity.institutionId
    profileUpdate.plaid_institution_name = plaidIdentity.institutionName
    profileUpdate.plaid_account_mask = plaidIdentity.accounts[0]?.mask ?? null
  }

  const { error } = await getSupabase()
    .from("user_profiles")
    .update(profileUpdate)
    .eq("clerk_user_id", userId)

  if (error) {
    console.error("Supabase Plaid save error:", error)
    return NextResponse.json(
      { error: "Failed to save bank connection" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    warnings: verificationWarnings.length > 0 ? verificationWarnings : undefined,
  })
}
