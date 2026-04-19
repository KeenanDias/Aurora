/**
 * Calculate daily Safe-to-Spend with Safety Buffer ("The Moat").
 *
 * Liquidity:
 *   Spendable Cash = Checking Available - Credit Card Balances
 *   Visual Spendable Cash = Spendable Cash - Safety Buffer  (what the user sees)
 *
 * Daily Safe-to-Spend:
 *   (Monthly Income - Fixed Bills - Monthly Savings Goal - Safety Buffer - Spent This Month)
 *   / Days Remaining in Month
 */

export type AccountBalance = {
  type: "depository" | "credit" | "loan" | "investment" | "other"
  subtype?: string | null
  currentBalance: number
  availableBalance: number | null
}

export function calculateSafeToSpend(params: {
  monthlyIncome: number
  fixedBills: number
  goalAmount: number | null
  goalDeadline: string | null // ISO date
  safetyBuffer: number
  spentThisMonth: number
  taxWithholding?: boolean
  accounts?: AccountBalance[]
}) {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1)

  // Effective income after optional tax withholding
  let effectiveIncome = params.monthlyIncome
  if (params.taxWithholding) {
    effectiveIncome *= 0.75 // hide 25% for self-employment taxes
  }

  // Monthly savings goal based on goal and deadline
  let monthlySavingsGoal = 0
  if (params.goalAmount && params.goalDeadline) {
    const deadline = new Date(params.goalDeadline)
    const monthsRemaining = Math.max(
      1,
      (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth())
    )
    monthlySavingsGoal = params.goalAmount / monthsRemaining
  }

  // Total monthly obligations — includes safety buffer
  const monthlyObligations =
    params.fixedBills + monthlySavingsGoal + params.safetyBuffer

  // What's left for the whole month
  const monthlyAvailable = effectiveIncome - monthlyObligations

  // Subtract what's already been spent this month
  const remainingBudget = monthlyAvailable - params.spentThisMonth

  // Daily amount
  const dailySafeToSpend = remainingBudget / daysRemaining

  // Liquidity: Spendable Cash from actual account balances
  let spendableCash: number | null = null
  let visualSpendableCash: number | null = null
  let checkingTotal = 0
  let creditCardDebt = 0

  if (params.accounts && params.accounts.length > 0) {
    for (const acct of params.accounts) {
      if (acct.type === "depository") {
        // Use available balance if present (accounts for pending holds), else current
        checkingTotal += acct.availableBalance ?? acct.currentBalance
      } else if (acct.type === "credit") {
        // Plaid reports credit card current balance as positive = amount owed
        creditCardDebt += acct.currentBalance
      }
    }

    spendableCash = checkingTotal - creditCardDebt
    // The "Moat" — what we show the user so they don't touch their buffer
    visualSpendableCash = spendableCash - params.safetyBuffer
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
  }
}
