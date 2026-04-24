import type { StatementIdentity } from "./parse-statement"

// ── Canadian institution code → Plaid institution_id mapping ─────────
// CPA 005 standard institution numbers + known Plaid IDs
const INSTITUTION_MAP: Record<string, { aliases: string[]; code: string }> = {
  ins_43: { aliases: ["td", "td canada trust", "toronto-dominion"], code: "004" },
  ins_37: { aliases: ["rbc", "royal bank", "rbc royal bank", "royal bank of canada"], code: "003" },
  ins_39: { aliases: ["scotiabank", "bank of nova scotia"], code: "002" },
  ins_36: { aliases: ["bmo", "bank of montreal"], code: "001" },
  ins_38: { aliases: ["cibc", "canadian imperial"], code: "010" },
  ins_107: { aliases: ["national bank", "banque nationale", "national bank of canada"], code: "006" },
  ins_40: { aliases: ["tangerine"], code: "030" },
  ins_131072: { aliases: ["simplii", "simplii financial"], code: "010" },
  ins_105: { aliases: ["desjardins"], code: "815" },
  ins_108: { aliases: ["atb", "atb financial"], code: "219" },
  ins_42: { aliases: ["hsbc", "hsbc canada", "hsbc bank"], code: "016" },
  // US banks
  ins_3: { aliases: ["chase", "jpmorgan", "jp morgan chase"], code: "" },
  ins_4: { aliases: ["wells fargo"], code: "" },
  ins_5: { aliases: ["bank of america"], code: "" },
  ins_9: { aliases: ["capital one"], code: "" },
}

export type PlaidAccountInfo = {
  institutionId: string
  institutionName: string
  accountMask: string
  eftInstitution?: string | null  // Canadian 3-digit code from /auth/get
  eftBranch?: string | null       // Canadian 5-digit transit from /auth/get
}

export type VerificationResult = {
  matched: boolean
  confidence: "high" | "medium" | "low" | "none"
  checks: {
    institutionMatch: boolean | null  // null = couldn't check (missing data)
    accountMaskMatch: boolean | null
    institutionNumberMatch: boolean | null
    transitMatch: boolean | null
  }
  failures: string[]
  warnings: string[]
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()
}

function institutionNamesMatch(
  statementName: string,
  plaidInstitutionId: string,
  plaidInstitutionName: string
): boolean {
  const norm = normalize(statementName)

  // Check against alias map using Plaid institution_id
  const entry = INSTITUTION_MAP[plaidInstitutionId]
  if (entry) {
    if (entry.aliases.some((a) => norm.includes(a) || a.includes(norm))) {
      return true
    }
  }

  // Fallback: check all alias lists (statement might use a name variant)
  for (const e of Object.values(INSTITUTION_MAP)) {
    const statementHit = e.aliases.some((a) => norm.includes(a) || a.includes(norm))
    const plaidHit = e.aliases.some((a) => normalize(plaidInstitutionName).includes(a))
    if (statementHit && plaidHit) return true
  }

  // Last resort: direct normalized comparison
  return normalize(plaidInstitutionName).includes(norm) || norm.includes(normalize(plaidInstitutionName))
}

export function verifyAccountMatch(
  statement: StatementIdentity,
  plaid: PlaidAccountInfo
): VerificationResult {
  const checks: VerificationResult["checks"] = {
    institutionMatch: null,
    accountMaskMatch: null,
    institutionNumberMatch: null,
    transitMatch: null,
  }
  const failures: string[] = []
  const warnings: string[] = []

  // 1. Institution name match
  if (statement.institutionName) {
    checks.institutionMatch = institutionNamesMatch(
      statement.institutionName,
      plaid.institutionId,
      plaid.institutionName
    )
    if (!checks.institutionMatch) {
      failures.push(
        `Statement is from "${statement.institutionName}" but your linked account is at "${plaid.institutionName}".`
      )
    }
  }

  // 2. Account mask match (last 4 digits)
  if (statement.accountMask && plaid.accountMask) {
    checks.accountMaskMatch = statement.accountMask === plaid.accountMask
    if (!checks.accountMaskMatch) {
      failures.push(
        `Account number ending in ${statement.accountMask} doesn't match your linked account ending in ${plaid.accountMask}.`
      )
    }
  }

  // 3. Canadian institution number match
  if (statement.institutionNumber && plaid.eftInstitution) {
    checks.institutionNumberMatch = statement.institutionNumber === plaid.eftInstitution
    if (!checks.institutionNumberMatch) {
      failures.push("Institution number on the statement doesn't match your linked bank.")
    }
  }

  // 4. Canadian transit/branch match
  if (statement.transitNumber && plaid.eftBranch) {
    checks.transitMatch = statement.transitNumber === plaid.eftBranch
    if (!checks.transitMatch) {
      // Soft signal — branches can differ (moved, opened at different branch)
      warnings.push("Branch/transit number differs — this may be a different branch of the same bank.")
    }
  }

  // Decision logic
  const hardChecks = [checks.institutionMatch, checks.accountMaskMatch, checks.institutionNumberMatch]
  const hardFailures = hardChecks.filter((c) => c === false).length
  const hardPasses = hardChecks.filter((c) => c === true).length

  let matched: boolean
  let confidence: VerificationResult["confidence"]

  if (hardFailures > 0) {
    // Any hard check explicitly failed
    matched = false
    confidence = "none"
  } else if (hardPasses >= 2) {
    matched = true
    confidence = "high"
  } else if (hardPasses === 1) {
    matched = true
    confidence = "medium"
  } else {
    // No data to check — can't verify
    matched = true // don't block if we can't verify
    confidence = "low"
    warnings.push("Could not extract enough identity info from the statement to verify. Proceeding without verification.")
  }

  return { matched, confidence, checks, failures, warnings }
}
