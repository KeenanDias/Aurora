import { describe, it, expect } from "vitest"
import { calculateSafeToSpend, type AccountBalance } from "@/lib/safe-to-spend"

/**
 * Tests for the "on track for goal + within daily safe-to-spend" coaching check.
 *
 * Scenario: a logged-in user has bank accounts (Plaid), a savings goal with a
 * deadline, and a record of what they've already saved. We want to verify that
 * given live bank data, the engine correctly answers two questions:
 *   1. Are they on pace toward their goal? (goalPacing.onTrack)
 *   2. Are they within their daily Safe-to-Spend? (dailySafeToSpend > 0, !isOverBudget)
 */

const accounts: AccountBalance[] = [
  { type: "depository", subtype: "checking", currentBalance: 4000, availableBalance: 4000 },
  { type: "credit", subtype: "credit card", currentBalance: 500, availableBalance: null },
]

describe("Goal tracking + Safe-to-Spend coaching check", () => {
  it("flags user as on track when savings pace meets monthly target and spending is within budget", () => {
    // April 15 — half of a 6-month goal period (April → October)
    // Goal: $6000 by Oct 15 → $1000/month → expect ~$500 saved halfway through April
    const result = calculateSafeToSpend({
      monthlyIncome: 5000,
      fixedBills: 1500,
      goalAmount: 6000,
      goalDeadline: "2026-10-15",
      goalStatus: "active",
      goalSaved: 600, // ahead of pace
      safetyBuffer: 200,
      spentThisMonth: 800, // moderate
      accounts,
      _now: new Date("2026-04-15T12:00:00"),
    })

    expect(result.goalPacing).not.toBeNull()
    expect(result.goalPacing!.onTrack).toBe(true)
    expect(result.goalPacing!.shortfall).toBe(0)
    expect(result.dailySafeToSpend).toBeGreaterThan(0)
    expect(result.isOverBudget).toBe(false)
  })

  it("flags user as behind on goal pace even when daily spending is on track", () => {
    const result = calculateSafeToSpend({
      monthlyIncome: 5000,
      fixedBills: 1500,
      goalAmount: 6000,
      goalDeadline: "2026-10-15",
      goalStatus: "active",
      goalSaved: 100, // way behind — should be ~$500 by now
      safetyBuffer: 200,
      spentThisMonth: 800,
      accounts,
      _now: new Date("2026-04-15T12:00:00"),
    })

    expect(result.goalPacing!.onTrack).toBe(false)
    expect(result.goalPacing!.shortfall).toBeGreaterThan(0)
    expect(result.goalPacing!.expectedSavedByNow).toBeGreaterThan(result.goalPacing!.actualSaved)
    // Spending is fine — coach should focus on goal pacing, not overspending
    expect(result.isOverBudget).toBe(false)
  })

  it("flags user as over daily limit when spending exceeds remaining budget", () => {
    const result = calculateSafeToSpend({
      monthlyIncome: 5000,
      fixedBills: 1500,
      goalAmount: 6000,
      goalDeadline: "2026-10-15",
      goalStatus: "active",
      goalSaved: 600,
      safetyBuffer: 200,
      spentThisMonth: 4000, // blew through the budget
      accounts,
      _now: new Date("2026-04-15T12:00:00"),
    })

    expect(result.isOverBudget).toBe(true)
    expect(result.dailySafeToSpend).toBe(0) // clamped at zero
    expect(result.remainingBudget).toBeLessThan(0)
  })

  it("treats a hit goal as completed and stops deducting savings — keeps user 'on track'", () => {
    const result = calculateSafeToSpend({
      monthlyIncome: 5000,
      fixedBills: 1500,
      goalAmount: 6000,
      goalDeadline: "2026-10-15",
      goalStatus: "active",
      goalSaved: 6000, // hit the goal
      safetyBuffer: 200,
      spentThisMonth: 800,
      accounts,
      _now: new Date("2026-04-15T12:00:00"),
    })

    expect(result.goalCompleted).toBe(true)
    expect(result.monthlySavingsGoal).toBe(0) // no longer deducting
    expect(result.goalPacing).toBeNull() // pacing irrelevant when goal completed
    expect(result.dailySafeToSpend).toBeGreaterThan(0)
  })

  it("uses live bank balances to compute spendable cash alongside goal pacing", () => {
    const result = calculateSafeToSpend({
      monthlyIncome: 5000,
      fixedBills: 1500,
      goalAmount: 6000,
      goalDeadline: "2026-10-15",
      goalStatus: "active",
      goalSaved: 500,
      safetyBuffer: 200,
      spentThisMonth: 800,
      accounts,
      _now: new Date("2026-04-15T12:00:00"),
    })

    // Spendable cash = checking ($4000) − credit card debt ($500) = $3500
    expect(result.spendableCash).toBe(3500)
    // Visual = spendable − safety buffer ($200) = $3300
    expect(result.visualSpendableCash).toBe(3300)
    // And goal pacing should still be evaluated
    expect(result.goalPacing).not.toBeNull()
  })

  it("returns null goalPacing when user has no goal set", () => {
    const result = calculateSafeToSpend({
      monthlyIncome: 5000,
      fixedBills: 1500,
      goalAmount: null,
      goalDeadline: null,
      safetyBuffer: 200,
      spentThisMonth: 800,
      accounts,
      _now: new Date("2026-04-15T12:00:00"),
    })

    expect(result.goalPacing).toBeNull()
  })
})
