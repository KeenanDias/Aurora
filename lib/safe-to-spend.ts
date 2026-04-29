/**
 * Calculate daily Safe-to-Spend with Safety Buffer ("The Moat").
 *
 * Liquidity:
 *   Spendable Cash = Checking Available - Credit Card Balances
 *   Visual Spendable Cash = Spendable Cash - Safety Buffer  (what the user sees)
 *
 * Daily Safe-to-Spend:
 *   (Monthly Income - Fixed Bills - Monthly Savings Goal - Safety Buffer - Escrow - Spent This Month)
 *   / Days Remaining in Month
 *
 * Escrow Logic ("Big Bill Protection"):
 *   If a known fixed bill is due within 7 days, subtract its full amount from
 *   spendable cash BEFORE dividing by days remaining. This prevents users from
 *   accidentally spending their rent money.
 *
 * Goal State Machine:
 *   active → completed (when goal_saved >= goal_amount)
 *   Goal deductions stop when status != "active"
 */

export type AccountBalance = {
  type: "depository" | "credit" | "loan" | "investment" | "other"
  subtype?: string | null
  currentBalance: number
  availableBalance: number | null
}

export type VaultMetrics = {
  totalIncome: number
  totalSpending: number
  fixedBills: number
  closingBalance: number | null
  periodStart: string
  periodEnd: string
}

export type UpcomingBill = {
  name: string
  amount: number
  dueDate: string // ISO date or day-of-month
}

export type GoalStatus = "active" | "completed" | "paused"

export function calculateSafeToSpend(params: {
  monthlyIncome: number
  fixedBills: number
  goalAmount: number | null
  goalDeadline: string | null // ISO date
  goalStatus?: GoalStatus | null
  goalSaved?: number | null
  safetyBuffer: number
  spentThisMonth: number
  taxWithholding?: boolean
  accounts?: AccountBalance[]
  vaultMetrics?: VaultMetrics | null
  upcomingBills?: UpcomingBill[] | null // bills due within 7 days for escrow
  _now?: Date // override current date (testing only)
}) {
  const now = params._now ?? new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1)

  // Effective income after optional tax withholding
  let effectiveIncome = params.monthlyIncome
  if (params.taxWithholding) {
    effectiveIncome *= 0.75 // hide 25% for self-employment taxes
  }

  // Merge vault (manual upload) data — treated as equal to Plaid data
  let fixedBills = params.fixedBills
  let spentThisMonth = params.spentThisMonth
  if (params.vaultMetrics) {
    const v = params.vaultMetrics
    // If vault shows higher income, use it (same logic as Plaid observed income)
    if (v.totalIncome > effectiveIncome) {
      effectiveIncome = v.totalIncome
      if (params.taxWithholding) effectiveIncome *= 0.75
    }
    // Merge vault spending into current month if the period overlaps
    const vEnd = new Date(v.periodEnd)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    if (vEnd >= startOfMonth) {
      fixedBills = Math.max(fixedBills, v.fixedBills)
      const vaultDiscretionary = v.totalSpending - v.fixedBills
      spentThisMonth = Math.max(spentThisMonth, vaultDiscretionary)
    }
  }

  // ── Goal State Machine ─────────────────────────────────────────────
  // Only deduct savings if goal is active and not yet reached
  let monthlySavingsGoal = 0
  const goalStatus = params.goalStatus ?? "active"
  const goalCompleted = goalStatus === "completed" ||
    (params.goalAmount != null && params.goalSaved != null && params.goalSaved >= params.goalAmount)

  if (params.goalAmount && params.goalDeadline && !goalCompleted && goalStatus === "active") {
    const deadline = new Date(params.goalDeadline)
    const monthsRemaining = Math.max(
      1,
      (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth())
    )
    monthlySavingsGoal = params.goalAmount / monthsRemaining
  }

  // ── Escrow: Big Bill Protection ────────────────────────────────────
  // If a known bill is due within 7 days, "protect" that money
  let escrowTotal = 0
  const escrowedBills: { name: string; amount: number; dueDate: string }[] = []
  if (params.upcomingBills && params.upcomingBills.length > 0) {
    for (const bill of params.upcomingBills) {
      const dueDate = new Date(bill.dueDate)
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        escrowTotal += bill.amount
        escrowedBills.push({ name: bill.name, amount: bill.amount, dueDate: bill.dueDate })
      }
    }
  }

  // Total monthly obligations — includes safety buffer + escrow
  const monthlyObligations =
    fixedBills + monthlySavingsGoal + params.safetyBuffer

  // What's left for the whole month
  const monthlyAvailable = effectiveIncome - monthlyObligations

  // Subtract what's already been spent + escrowed upcoming bills
  const remainingBudget = monthlyAvailable - spentThisMonth - escrowTotal

  // Daily amount
  const dailySafeToSpend = remainingBudget / daysRemaining

  // Liquidity: Spendable Cash from actual account balances
  let spendableCash: number | null = null
  let visualSpendableCash: number | null = null
  let checkingTotal = 0
  let creditCardDebt = 0

  // Use vault closing balance as spendable cash when no bank accounts are linked
  if ((!params.accounts || params.accounts.length === 0) && params.vaultMetrics?.closingBalance != null) {
    spendableCash = params.vaultMetrics.closingBalance
    visualSpendableCash = spendableCash - params.safetyBuffer - escrowTotal
    checkingTotal = params.vaultMetrics.closingBalance
  } else if (params.accounts && params.accounts.length > 0) {
    for (const acct of params.accounts) {
      if (acct.type === "depository") {
        checkingTotal += acct.availableBalance ?? acct.currentBalance
      } else if (acct.type === "credit") {
        creditCardDebt += acct.currentBalance
      }
    }

    spendableCash = checkingTotal - creditCardDebt
    // The "Moat" — subtract buffer AND escrowed bills from what user sees
    visualSpendableCash = spendableCash - params.safetyBuffer - escrowTotal
  }

  return {
    dailySafeToSpend: Math.max(0, Math.round(dailySafeToSpend * 100) / 100),
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    monthlyAvailable: Math.round(monthlyAvailable * 100) / 100,
    monthlySavingsGoal: Math.round(monthlySavingsGoal * 100) / 100,
    daysRemaining,
    spentThisMonth: params.spentThisMonth,
    isOverBudget: remainingBudget < 0,
    safetyBuffer: params.safetyBuffer,
    spendableCash: spendableCash != null ? Math.round(spendableCash * 100) / 100 : null,
    visualSpendableCash: visualSpendableCash != null ? Math.round(visualSpendableCash * 100) / 100 : null,
    checkingTotal: Math.round(checkingTotal * 100) / 100,
    creditCardDebt: Math.round(creditCardDebt * 100) / 100,
    // New fields
    goalCompleted,
    escrowTotal: Math.round(escrowTotal * 100) / 100,
    escrowedBills,
  }
}
