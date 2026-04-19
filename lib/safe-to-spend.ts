/**
 * Calculate daily Safe-to-Spend.
 *
 * Formula:
 *   Daily Safe-to-Spend =
 *     (Monthly Income - Fixed Bills - Monthly Savings Goal - Spent This Month)
 *     / Days Remaining in Month
 *
 * Monthly Savings Goal = Goal Amount / Months Remaining until deadline
 */
export function calculateSafeToSpend(params: {
  monthlyIncome: number
  fixedBills: number
  goalAmount: number | null
  goalDeadline: string | null // ISO date
  safetyBuffer: number
  spentThisMonth: number
  taxWithholding?: boolean
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

  // Total monthly obligations
  const monthlyObligations =
    params.fixedBills + monthlySavingsGoal + params.safetyBuffer

  // What's left for the whole month
  const monthlyAvailable = effectiveIncome - monthlyObligations

  // Subtract what's already been spent this month
  const remainingBudget = monthlyAvailable - params.spentThisMonth

  // Daily amount
  const dailySafeToSpend = remainingBudget / daysRemaining

  return {
    dailySafeToSpend: Math.max(0, Math.round(dailySafeToSpend * 100) / 100),
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    monthlyAvailable: Math.round(monthlyAvailable * 100) / 100,
    monthlySavingsGoal: Math.round(monthlySavingsGoal * 100) / 100,
    daysRemaining,
    spentThisMonth: params.spentThisMonth,
    isOverBudget: remainingBudget < 0,
  }
}
