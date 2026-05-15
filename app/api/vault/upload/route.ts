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
  // "force" lets the user override a verification mismatch (e.g. they
  // intentionally uploaded a different account's statement). Set when the
  // dashboard's mismatch banner offers "Upload anyway".
  const force = formData.get("force") === "true"
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
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error("parseStatement failed:", reason, err)

    // Canadian banks (TD/RBC/Scotia in particular) ship statements with a
    // "Crypt" filter on text streams that pdf-parse's bundled pdfjs can't
    // decode. Detect those signatures and give the user a concrete fix.
    const looksEncrypted =
      /crypt|encrypt|password|invalid number|formaterror|streamtype/i.test(reason)

    const userMessage = looksEncrypted
      ? "This PDF appears to use bank-side encryption that we can't read directly. Quick fix: open it in your browser or Preview/Adobe, choose \"Print → Save as PDF\", and upload that re-saved copy. We'll process it instantly."
      : "Could not parse this PDF. Please ensure it's a bank statement (not a receipt or screenshot)."

    return NextResponse.json(
      {
        error: userMessage,
        code: looksEncrypted ? "PDF_ENCRYPTED" : "PDF_PARSE_FAILED",
        debug: process.env.NODE_ENV === "development" ? reason : undefined,
      },
      { status: 422 }
    )
  }

  // 1b. Duplicate detection. Same user + same period + same totals = same statement.
  // Period-bounds-only would false-positive on a re-issued statement; combining
  // totals tightens it without needing a file-hash column.
  const { data: dup } = await getSupabase()
    .from("vault_uploads")
    .select("id, filename, period_start, period_end, total_income, total_spending, transaction_count, created_at")
    .eq("clerk_user_id", userId)
    .eq("period_start", parsed.periodStart)
    .eq("period_end", parsed.periodEnd)
    .eq("total_income", parsed.totalIncome)
    .eq("total_spending", parsed.totalSpending)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dup) {
    return NextResponse.json(
      {
        success: false,
        duplicate: true,
        existing: {
          id: dup.id,
          filename: dup.filename,
          uploadedAt: dup.created_at,
          periodStart: dup.period_start,
          periodEnd: dup.period_end,
          totalIncome: parsed.totalIncome,
          totalSpending: parsed.totalSpending,
          transactionCount: parsed.transactions.length,
        },
        error:
          "Looks like you've already uploaded this exact statement — same period, same totals. It's already safe in your Data Vault, no need to re-upload.",
      },
      { status: 409 }
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
      if (!force) {
        // First attempt — surface the mismatch so the user can confirm.
        return NextResponse.json({
          success: false,
          mismatch: true,
          failures: result.failures,
          warnings: result.warnings,
          parsedIdentity: parsed.identity,
        }, { status: 409 })
      }
      // User explicitly chose "Upload anyway" — accept it but flag the
      // verification status so the dashboard can show it as unverified.
      verificationStatus = "user_overridden"
      verificationWarnings = [
        ...result.warnings,
        ...result.failures,
        "User overrode the verification mismatch.",
      ]
    } else {
      verificationStatus = "verified"
    }
  }

  // 3. Encrypt the raw PDF with AES-256-GCM (versioned key)
  const { encrypted, iv, authTag, keyVersion } = encryptBuffer(buffer)

  // 3a. Push the encrypted bytes to Supabase Storage. Storing multi-MB hex
  // strings directly in a column trips PostgREST's body limit ("fetch failed
  // / SocketError: other side closed"). Storage handles large blobs natively.
  const STORAGE_BUCKET = "vault-statements"
  const storagePath = `${userId}/${crypto.randomUUID()}.bin`
  const encryptedBytes = Buffer.from(encrypted, "hex")
  const supabase = getSupabase()

  const tryUpload = () =>
    supabase.storage.from(STORAGE_BUCKET).upload(storagePath, encryptedBytes, {
      contentType: "application/octet-stream",
      upsert: false,
    })

  let upload = await tryUpload()

  // Auto-create the bucket on first upload so users don't have to touch the
  // Supabase dashboard. Service-role key has bucket-create permission.
  if (upload.error && /bucket not found/i.test(upload.error.message)) {
    console.warn(`Storage bucket "${STORAGE_BUCKET}" missing — creating it now.`)
    const create = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 15 * 1024 * 1024, // 15 MB
      allowedMimeTypes: ["application/octet-stream"],
    })
    if (create.error && !/already exists/i.test(create.error.message)) {
      console.error("Bucket create failed:", create.error)
      return NextResponse.json(
        {
          error: "Could not provision encrypted-statement storage. Try again in a moment.",
          debug: process.env.NODE_ENV === "development" ? create.error.message : undefined,
        },
        { status: 500 }
      )
    }
    upload = await tryUpload()
  }

  if (upload.error) {
    console.error("Storage upload failed:", upload.error)
    return NextResponse.json(
      {
        error: "Could not store encrypted statement.",
        debug: process.env.NODE_ENV === "development" ? upload.error.message : undefined,
      },
      { status: 500 }
    )
  }

  // 4. Store metadata + identity + storage pointer in Supabase
  const record: Record<string, unknown> = {
    clerk_user_id: userId,
    filename: file.name,
    file_size: file.size,
    storage_path: storagePath,
    encryption_iv: iv,
    encryption_auth_tag: authTag,
    key_version: keyVersion,
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

  // Generic insert that survives schema drift: if PostgREST reports a missing
  // column (PGRST204 / "Could not find the 'foo' column"), drop that column
  // from the payload and retry. Caps retries so one truly bad insert can't
  // loop. Apply sql/007 to make all of these unnecessary.
  const insertSelect =
    "id, filename, period_start, period_end, total_income, total_spending, fixed_bills, transaction_count, created_at"
  let working: Record<string, unknown> = { ...record }
  let data: unknown = null
  let error: { code?: string; message: string } | null = null
  const droppedColumns: string[] = []

  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await getSupabase()
      .from("vault_uploads")
      .insert(working)
      .select(insertSelect)
      .single()
    data = result.data
    error = result.error
    if (!error) break

    const missingMatch = error.message?.match(/Could not find the '([^']+)' column/i)
    const missingCol = missingMatch?.[1]
    if (missingCol && missingCol in working) {
      droppedColumns.push(missingCol)
      delete working[missingCol]
      continue
    }
    break
  }

  if (droppedColumns.length > 0) {
    console.warn(
      `vault_uploads insert succeeded after dropping missing columns: ${droppedColumns.join(", ")}. Apply the latest sql/ migration to your Supabase instance.`
    )
  }

  if (error) {
    console.error("Vault insert error:", error)
    return NextResponse.json(
      { error: "Failed to save statement", debug: process.env.NODE_ENV === "development" ? error.message : undefined },
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
