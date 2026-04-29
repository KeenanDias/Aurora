import { describe, it, expect } from "vitest"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"

describe("calculateSafeToSpend", () => {
  describe("Core Formula: (Income - Bills - Goal - Buffer - Spent) / Days", () => {
    it("calculates correct daily safe-to-spend for a standard case", () => {
      // April 1 → daysRemaining = 30 - 1 + 1 = 30
      const result = calculateSafeToSpend({
        monthlyIncome: 3000,
        fixedBills: 1000,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 200,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-01T12:00:00"),
      })

      // Available = 3000 - 1000 - 0 - 200 = 1800
      // Daily = 1800 / 30 = 60
      expect(result.daysRemaining).toBe(30)
      expect(result.monthlyAvailable).toBe(1800)
      expect(result.remainingBudget).toBe(1800)
      expect(result.dailySafeToSpend).toBe(60)
      expect(result.isOverBudget).toBe(false)
    })

    it("subtracts monthly goal savings from available budget", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 3000,
        fixedBills: 500,
        goalAmount: 6000,
        goalDeadline: "2026-10-15", // 6 months away → $1000/month
        safetyBuffer: 0,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-15T12:00:00"),
      })

      // monthsRemaining = (2026-2026)*12 + (9-3) = 6 (Oct index 9 - Apr index 3)
      // monthlySavingsGoal = 6000 / 6 = 1000
      // Available = 3000 - 500 - 1000 = 1500
      // daysRemaining = 30 - 15 + 1 = 16
      // daily = 1500 / 16 = 93.75
      expect(result.monthlySavingsGoal).toBe(1000)
      expect(result.monthlyAvailable).toBe(1500)
      expect(result.dailySafeToSpend).toBe(93.75)
    })

    it("applies 25% tax withholding for gig workers", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 4000,
        fixedBills: 500,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 0,
        taxWithholding: true,
        accounts: [],
        _now: new Date("2026-04-01T12:00:00"),
      })

      // Effective income = 4000 * 0.75 = 3000
      // Available = 3000 - 500 = 2500
      // Daily = 2500 / 30 = 83.33
      expect(result.monthlyAvailable).toBe(2500)
      expect(result.dailySafeToSpend).toBe(83.33)
    })
  })

  describe("Case A: Bills exceed income → returns $0 (never negative)", () => {
    it("returns $0 daily when bills + goal > income", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 1000,
        fixedBills: 1500,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 200,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-10T12:00:00"),
      })

      expect(result.dailySafeToSpend).toBe(0)
      expect(result.isOverBudget).toBe(true)
    })

    it("returns $0 when already overspent for the month", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 2000,
        fixedBills: 500,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 2000,
        accounts: [],
        _now: new Date("2026-04-20T12:00:00"),
      })

      expect(result.dailySafeToSpend).toBe(0)
      expect(result.isOverBudget).toBe(true)
    })
  })

  describe("Case B: Last day of month → divides by 1", () => {
    it("gives full remaining budget on the last day", () => {
      // April 30 → daysRemaining = 30 - 30 + 1 = 1
      const result = calculateSafeToSpend({
        monthlyIncome: 2000,
        fixedBills: 500,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 500,
        accounts: [],
        _now: new Date("2026-04-30T12:00:00"),
      })

      // Available = 2000 - 500 = 1500
      // Remaining = 1500 - 500 = 1000
      // Daily = 1000 / 1 = 1000
      expect(result.daysRemaining).toBe(1)
      expect(result.dailySafeToSpend).toBe(1000)
    })
  })

  describe("Case C: Zero income → no divide-by-zero crash", () => {
    it("handles $0 income without crashing", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 0,
        fixedBills: 0,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-15T12:00:00"),
      })

      expect(result.dailySafeToSpend).toBe(0)
      expect(result.remainingBudget).toBe(0)
      expect(Number.isFinite(result.dailySafeToSpend)).toBe(true)
    })

    it("handles $0 income with existing spending", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 0,
        fixedBills: 0,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 500,
        accounts: [],
        _now: new Date("2026-04-15T12:00:00"),
      })

      expect(result.dailySafeToSpend).toBe(0)
      expect(result.isOverBudget).toBe(true)
      expect(Number.isFinite(result.dailySafeToSpend)).toBe(true)
    })
  })

  describe("Overspending deficit carries forward", () => {
    it("reduces next day's safe-to-spend after overspending", () => {
      // Day 1: April 1, 30 days remaining
      const day1 = calculateSafeToSpend({
        monthlyIncome: 3000,
        fixedBills: 1000,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-01T12:00:00"),
      })

      // Day 1: $2000 / 30 = $66.67/day
      expect(day1.dailySafeToSpend).toBe(66.67)

      // User spends $100 on day 1 (over by ~$33)
      // Day 2: April 2, 29 days remaining
      const day2 = calculateSafeToSpend({
        monthlyIncome: 3000,
        fixedBills: 1000,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 100,
        accounts: [],
        _now: new Date("2026-04-02T12:00:00"),
      })

      // Day 2: (2000 - 100) / 29 = 1900/29 = 65.52
      expect(day2.dailySafeToSpend).toBe(65.52)
      expect(day2.dailySafeToSpend).toBeLessThan(day1.dailySafeToSpend)
    })
  })

  describe("Vault metrics merge", () => {
    it("uses vault income when higher than self-reported", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 2000,
        fixedBills: 0,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 0,
        spentThisMonth: 0,
        accounts: [],
        vaultMetrics: {
          totalIncome: 3000,
          totalSpending: 500,
          fixedBills: 200,
          closingBalance: 1500,
          periodStart: "2026-04-01",
          periodEnd: "2026-04-14",
        },
        _now: new Date("2026-04-15T12:00:00"),
      })

      expect(result.monthlyAvailable).toBeGreaterThan(2000)
    })

    it("uses vault closing balance for spendable cash when no bank linked", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 2000,
        fixedBills: 0,
        goalAmount: null,
        goalDeadline: null,
        safetyBuffer: 100,
        spentThisMonth: 0,
        accounts: [],
        vaultMetrics: {
          totalIncome: 2000,
          totalSpending: 500,
          fixedBills: 200,
          closingBalance: 476.96,
          periodStart: "2026-04-01",
          periodEnd: "2026-04-14",
        },
        _now: new Date("2026-04-15T12:00:00"),
      })

      expect(result.spendableCash).toBe(476.96)
      expect(result.visualSpendableCash).toBe(376.96)
    })
  })

  describe("Goal savings calculation", () => {
    it("calculates monthly goal correctly across months", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 5000,
        fixedBills: 0,
        goalAmount: 12000,
        goalDeadline: "2027-04-15", // 12 months away
        safetyBuffer: 0,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-15T12:00:00"),
      })

      expect(result.monthlySavingsGoal).toBe(1000)
    })

    it("handles deadline in current month (1 month minimum)", () => {
      const result = calculateSafeToSpend({
        monthlyIncome: 5000,
        fixedBills: 0,
        goalAmount: 1000,
        goalDeadline: "2026-04-30",
        safetyBuffer: 0,
        spentThisMonth: 0,
        accounts: [],
        _now: new Date("2026-04-15T12:00:00"),
      })

      // 0 months diff → clamped to 1
      expect(result.monthlySavingsGoal).toBe(1000)
    })
  })
})
