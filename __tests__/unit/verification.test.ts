import { describe, it, expect } from "vitest"
import { verifyAccountMatch } from "@/lib/verify-account-match"
import type { PlaidAccountInfo } from "@/lib/verify-account-match"
import type { StatementIdentity } from "@/lib/parse-statement"

// Helper to build a Plaid account info object
function plaid(overrides: Partial<PlaidAccountInfo> = {}): PlaidAccountInfo {
  return {
    institutionId: "ins_43",
    institutionName: "TD Canada Trust",
    accountMask: "1234",
    eftInstitution: "004",
    eftBranch: "12345",
    ...overrides,
  }
}

// Helper to build a statement identity
function stmt(overrides: Partial<StatementIdentity> = {}): StatementIdentity {
  return {
    institutionName: "TD Canada Trust",
    accountMask: "1234",
    accountHolderName: "Keenan Dias",
    transitNumber: "12345",
    institutionNumber: "004",
    ...overrides,
  }
}

describe("verifyAccountMatch", () => {
  describe("Canadian bank alias matching", () => {
    it("matches 'TD Canada Trust' to Plaid ins_43", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "TD Canada Trust" }),
        plaid({ institutionId: "ins_43", institutionName: "TD Canada Trust" })
      )

      expect(result.matched).toBe(true)
      expect(result.checks.institutionMatch).toBe(true)
      expect(result.confidence).toBe("high")
    })

    it("matches 'TD' shorthand to 'TD Canada Trust'", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "TD" }),
        plaid({ institutionId: "ins_43", institutionName: "TD Canada Trust" })
      )

      expect(result.matched).toBe(true)
      expect(result.checks.institutionMatch).toBe(true)
    })

    it("matches 'Toronto-Dominion' to 'TD Canada Trust'", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "Toronto-Dominion" }),
        plaid({ institutionId: "ins_43", institutionName: "TD Canada Trust" })
      )

      expect(result.matched).toBe(true)
      expect(result.checks.institutionMatch).toBe(true)
    })

    it("matches 'Royal Bank of Canada' to RBC", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "Royal Bank of Canada" }),
        plaid({ institutionId: "ins_37", institutionName: "RBC Royal Bank" })
      )

      expect(result.matched).toBe(true)
      expect(result.checks.institutionMatch).toBe(true)
    })

    it("matches 'Scotiabank' to 'Bank of Nova Scotia'", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "Scotiabank" }),
        plaid({ institutionId: "ins_39", institutionName: "Bank of Nova Scotia" })
      )

      expect(result.matched).toBe(true)
    })

    it("matches 'BMO' to 'Bank of Montreal'", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "BMO" }),
        plaid({ institutionId: "ins_36", institutionName: "Bank of Montreal" })
      )

      expect(result.matched).toBe(true)
    })
  })

  describe("Account mask matching", () => {
    it("matches identical last 4 digits", () => {
      const result = verifyAccountMatch(
        stmt({ accountMask: "6789" }),
        plaid({ accountMask: "6789" })
      )

      expect(result.checks.accountMaskMatch).toBe(true)
    })

    it("fails on different last 4 digits", () => {
      const result = verifyAccountMatch(
        stmt({ accountMask: "6789" }),
        plaid({ accountMask: "9999" })
      )

      expect(result.checks.accountMaskMatch).toBe(false)
      expect(result.matched).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  describe("Institution number matching (CPA 005)", () => {
    it("matches institution code 004 for TD", () => {
      const result = verifyAccountMatch(
        stmt({ institutionNumber: "004" }),
        plaid({ eftInstitution: "004" })
      )

      expect(result.checks.institutionNumberMatch).toBe(true)
    })

    it("fails when institution codes differ", () => {
      const result = verifyAccountMatch(
        stmt({ institutionNumber: "004" }),
        plaid({ eftInstitution: "003" }) // RBC code on a TD statement
      )

      expect(result.checks.institutionNumberMatch).toBe(false)
      expect(result.matched).toBe(false)
    })
  })

  describe("Transit/branch number matching", () => {
    it("warns (not blocks) on branch mismatch", () => {
      const result = verifyAccountMatch(
        stmt({ transitNumber: "11111" }),
        plaid({ eftBranch: "22222" })
      )

      // Transit mismatch is a warning, not a hard failure
      expect(result.checks.transitMatch).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      // Should still match if other checks pass
      expect(result.matched).toBe(true)
    })
  })

  describe("Confidence scoring", () => {
    it("returns 'high' confidence when 2+ hard checks pass", () => {
      const result = verifyAccountMatch(stmt(), plaid())

      expect(result.confidence).toBe("high")
      expect(result.matched).toBe(true)
    })

    it("returns 'medium' confidence when only 1 hard check passes", () => {
      const result = verifyAccountMatch(
        stmt({ accountMask: null, institutionNumber: null }),
        plaid()
      )

      expect(result.confidence).toBe("medium")
      expect(result.matched).toBe(true)
    })

    it("returns 'low' confidence when no identity data extracted", () => {
      const result = verifyAccountMatch(
        stmt({
          institutionName: null,
          accountMask: null,
          institutionNumber: null,
          transitNumber: null,
        }),
        plaid()
      )

      expect(result.confidence).toBe("low")
      // Should NOT block — can't verify either way
      expect(result.matched).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("returns 'none' confidence on hard failure", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "Chase", institutionNumber: null }),
        plaid({ institutionId: "ins_43", institutionName: "TD Canada Trust" })
      )

      expect(result.confidence).toBe("none")
      expect(result.matched).toBe(false)
    })
  })

  describe("Cross-institution mismatch detection", () => {
    it("detects TD statement uploaded against RBC account", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "TD Canada Trust", institutionNumber: "004" }),
        plaid({
          institutionId: "ins_37",
          institutionName: "RBC Royal Bank",
          eftInstitution: "003",
        })
      )

      expect(result.matched).toBe(false)
      expect(result.failures.length).toBeGreaterThanOrEqual(1)
      expect(result.failures.some((f) => f.includes("TD") || f.includes("RBC"))).toBe(true)
    })

    it("detects US bank statement against Canadian account", () => {
      const result = verifyAccountMatch(
        stmt({ institutionName: "Chase", accountMask: "5555", institutionNumber: null }),
        plaid({
          institutionId: "ins_43",
          institutionName: "TD Canada Trust",
          accountMask: "1234",
        })
      )

      expect(result.matched).toBe(false)
    })
  })
})
