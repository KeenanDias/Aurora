import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { encryptBuffer } from "@/lib/encryption"
import { parseStatement } from "@/lib/parse-statement"
import { verifyAccountMatch } from "@/lib/verify-account-match"

export const maxDuration = 30 // allow time for PDF parsing + encryption

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    )
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 1. Parse the PDF to extract transaction data + identity
  let parsed
  try {
    parsed = await parseStatement(buffer)
  } catch {
    return NextResponse.json(
      { error: "Could not parse this PDF. Please ensure it's a bank statement." },
      { status: 422 }
    )
  }

  // 2. If bank is linked, verify statement matches the Plaid account
  let verificationStatus = "pending"
  let verificationResult = null
  let verificationWarnings: string[] = []

  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("plaid_institution_id, plaid_institution_name, plaid_account_mask, bank_linked")
    .eq("clerk_user_id", userId)
    .single()

  if (profile?.bank_linked && profile.plaid_institution_name) {
    const result = verifyAccountMatch(parsed.identity, {
      institutionId: profile.plaid_institution_id ?? "",
      institutionName: profile.plaid_institution_name,
      accountMask: profile.plaid_account_mask ?? "",
    })

    verificationResult = result
    verificationWarnings = result.warnings

    if (!result.matched) {
      // Return mismatch — frontend should ask for confirmation
      return NextResponse.json({
        success: false,
        mismatch: true,
        failures: result.failures,
        warnings: result.warnings,
        parsedIdentity: parsed.identity,
      }, { status: 409 })
    }

    verificationStatus = "verified"
  }

  // 3. Encrypt the raw PDF with AES-256-GCM
  const { encrypted, iv, authTag } = encryptBuffer(buffer)

  // 4. Store metadata + identity + encrypted blob in Supabase
  const record: Record<string, unknown> = {
    clerk_user_id: userId,
    filename: file.name,
    file_size: file.size,
    encrypted_data: encrypted,
    encryption_iv: iv,
    encryption_auth_tag: authTag,
    period_start: parsed.periodStart,
    period_end: parsed.periodEnd,
    total_income: parsed.totalIncome,
    total_spending: parsed.totalSpending,
    fixed_bills: parsed.fixedBills,
    closing_balance: parsed.closingBalance,
    // Identity fields for future verification
    institution_name: parsed.identity.institutionName,
    account_mask: parsed.identity.accountMask,
    account_holder_name: parsed.identity.accountHolderName,
    transit_number: parsed.identity.transitNumber,
    institution_number: parsed.identity.institutionNumber,
    verification_status: verificationStatus,
    verification_details: verificationResult ? JSON.stringify(verificationResult) : null,
    transaction_count: parsed.transactions.length,
    transactions_json: JSON.stringify(parsed.transactions),
    source: "manual_upload",
    last_accessed: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabase()
    .from("vault_uploads")
    .insert(record)
    .select("id, filename, period_start, period_end, total_income, total_spending, fixed_bills, transaction_count, created_at")
    .single()

  if (error) {
    console.error("Vault insert error:", error)
    return NextResponse.json(
      { error: "Failed to save statement" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    upload: data,
    verification: verificationStatus,
    warnings: verificationWarnings.length > 0 ? verificationWarnings : undefined,
    summary: {
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      totalIncome: parsed.totalIncome,
      totalSpending: parsed.totalSpending,
      fixedBills: parsed.fixedBills,
      transactionCount: parsed.transactions.length,
    },
  })
}
