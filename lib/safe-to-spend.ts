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

export type EnrolledGoal = {
  id?: string
  amount: number
  saved: number
  deadline: string | null // ISO date
  description?: string
}

const LOW_LIQUIDITY_FLOOR = 20 // dollars/day

export function calculateSafeToSpend(params: {
  monthlyIncome: number
  fixedBills: number
  // Legacy single-goal inputs — still honored when activeGoals is omitted,
  // so existing call sites keep working until they're migrated.
  goalAmount: number | null
  goalDeadline: string | null // ISO date
  goalStatus?: GoalStatus | null
  goalSaved?: number | null
  // New multi-goal feed. Pass enrolled goals (is_enrolled=true) only.
  // Each one's required monthly contribution is summed into the bite.
  activeGoals?: EnrolledGoal[]
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
    // Normalize vault totals to a monthly rate. A statement covering 60
    // days isn't double a month's income. Without this, multi-month
    // statements (or short partial-month statements) skewed STS heavily.
    const periodDays = Math.max(
      1,
      Math.round(
        (new Date(v.periodEnd).getTime() - new Date(v.periodStart).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    )
    const factor = 30.44 / periodDays
    const monthlyVaultIncome = v.totalIncome * factor

    // Only upgrade the effective income if the vault signal is plausible —
    // within a 2× ceiling of the existing effective income, so a savings-
    // account statement (where "income" is just transfer-ins) can't blow
    // up the math.
    if (
      monthlyVaultIncome > effectiveIncome &&
      (effectiveIncome === 0 || monthlyVaultIncome <= effectiveIncome * 2)
    ) {
      effectiveIncome = monthlyVaultIncome
      if (params.taxWithholding) effectiveIncome *= 0.75
    }

    // Merge vault spending into current month if the period overlaps
    const vEnd = new Date(v.periodEnd)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    if (vEnd >= startOfMonth) {
      // Same monthly normalization for spending merges that span the
      // current month — don't import 2 months of spend as if it happened
      // this month.
      fixedBills = Math.max(fixedBills, v.fixedBills * factor)
      const vaultDiscretionary = (v.totalSpending - v.fixedBills) * factor
      spentThisMonth = Math.max(spentThisMonth, vaultDiscretionary)
    }
  }

  // ── Goal Bite — multi-goal "Active Enrollment" ─────────────────────
  // For each enrolled goal, compute its required monthly contribution
  // (remaining ÷ months until deadline) and sum them. Backwards-compatible:
  // if no activeGoals[] passed, fall back to the legacy single-goal params.
  let monthlySavingsGoal = 0
  const goalBitesByGoal: { id?: string; description?: string; monthlyBite: number }[] = []

  const computeMonthlyBite = (g: { amount: number; saved: number; deadline: string | null }) => {
    if (g.saved >= g.amount) return 0
    if (!g.deadline) return 0
    const deadline = new Date(g.deadline)
    const monthsRemaining = Math.max(
      1,
      (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth())
    )
    const remaining = Math.max(0, g.amount - g.saved)
    return remaining / monthsRemaining
  }

  // Legacy single-goal completion is still surfaced (some callers read goalCompleted)
  const goalStatus = params.goalStatus ?? "active"
  const goalCompleted = goalStatus === "completed" ||
    (params.goalAmount != null && params.goalSaved != null && params.goalSaved >= params.goalAmount)

  if (params.activeGoals && params.activeGoals.length > 0) {
    for (const g of params.activeGoals) {
      const bite = computeMonthlyBite(g)
      if (bite <= 0) continue
      monthlySavingsGoal += bite
      goalBitesByGoal.push({
        id: g.id,
        description: g.description,
        monthlyBite: Math.round(bite * 100) / 100,
      })
    }
  } else if (params.goalAmount && params.goalDeadline && !goalCompleted && goalStatus === "active") {
    // Legacy fallback — single primary goal
    const bite = computeMonthlyBite({
      amount: params.goalAmount,
      saved: params.goalSaved ?? 0,
      deadline: params.goalDeadline,
    })
    monthlySavingsGoal = bite
    if (bite > 0) {
      goalBitesByGoal.push({ monthlyBite: Math.round(bite * 100) / 100, description: "Primary goal" })
    }
  }

  const totalMonthlyGoalBite = monthlySavingsGoal

  // ── Escrow: Big Bill Protection (Weighted Ramp) ────────────────────
  // Bite scales as the due date approaches: weight = 1 - (daysUntilDue / 7).
  // Day-of (daysUntilDue=0) → full bite. 7 days out → 0 bite.
  // We subtract weightedEscrowBite from the daily limit directly so the
  // pressure shows up where it should — in the next few days, not spread
  // thin across the whole month.
  let escrowTotal = 0
  let weightedEscrowBite = 0
  const escrowedBills: { name: string; amount: number; dueDate: string }[] = []
  if (params.upcomingBills && params.upcomingBills.length > 0) {
    for (const bill of params.upcomingBills) {
      const dueDate = new Date(bill.dueDate)
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        escrowTotal += bill.amount
        const weight = 1 - daysUntilDue / 7
        weightedEscrowBite += bill.amount * weight
        escrowedBills.push({ name: bill.name, amount: bill.amount, dueDate: bill.dueDate })
      }
    }
  }

  // Total monthly obligations — includes safety buffer (escrow handled separately below)
  const monthlyObligations = fixedBills + monthlySavingsGoal + params.safetyBuffer

  // What's left for the whole month (escrow still subtracted at full amount —
  // that money truly is unavailable, but the daily ramp determines how the
  // pain is distributed across the next 7 days)
  const monthlyAvailable = effectiveIncome - monthlyObligations
  const remainingBudget = monthlyAvailable - spentThisMonth - escrowTotal

  // Daily amount — base divides remaining by days, then applies the ramp bite.
  // This makes the daily limit shrink hardest the day before a bill is due.
  const baseDaily = (monthlyAvailable - spentThisMonth) / daysRemaining
  const dailySafeToSpend = baseDaily - weightedEscrowBite

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

  // ── Coaching: goal pacing + spending pacing ───────────────────────
  // "Expected saved by now" = goalAmount * (months elapsed / total months)
  let goalPacing: {
    onTrack: boolean
    expectedSavedByNow: number
    actualSaved: number
    shortfall: number
  } | null = null
  if (params.goalAmount && params.goalDeadline && !goalCompleted) {
    const deadline = new Date(params.goalDeadline)
    const totalMonths = Math.max(
      1,
      (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth()) +
        Math.ceil(dayOfMonth / daysInMonth)
    )
    const monthlyTarget = params.goalAmount / totalMonths
    const monthFraction = dayOfMonth / daysInMonth
    const expectedSavedByNow = monthlyTarget * monthFraction
    const actualSaved = params.goalSaved ?? 0
    goalPacing = {
      onTrack: actualSaved >= expectedSavedByNow,
      expectedSavedByNow: Math.round(expectedSavedByNow * 100) / 100,
      actualSaved,
      shortfall: Math.max(0, Math.round((expectedSavedByNow - actualSaved) * 100) / 100),
    }
  }

  // ── Placeholder state (Ghost-Town fix) ─────────────────────────────
  // True when there's literally nothing to compute from — no income signal,
  // no vault data, no linked accounts. Caller should render a Setup Pending
  // card instead of stark $0 numbers.
  const isPlaceholder =
    effectiveIncome === 0 &&
    !params.vaultMetrics &&
    (!params.accounts || params.accounts.length === 0)

  // ── Safety floor — too many enrolled goals can starve the daily limit
  // The flag is informational; the math itself isn't clamped, so coaching
  // logic can decide whether to nudge the user back.
  const roundedDailySTS = Math.max(0, Math.round(dailySafeToSpend * 100) / 100)
  const isLowLiquidity = !isPlaceholder && roundedDailySTS < LOW_LIQUIDITY_FLOOR

  return {
    dailySafeToSpend: roundedDailySTS,
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    monthlyAvailable: Math.round(monthlyAvailable * 100) / 100,
    monthlySavingsGoal: Math.round(monthlySavingsGoal * 100) / 100,
    totalMonthlyGoalBite: Math.round(totalMonthlyGoalBite * 100) / 100,
    goalBitesByGoal,
    daysRemaining,
    spentThisMonth: params.spentThisMonth,
    isOverBudget: remainingBudget < 0,
    isLowLiquidity,
    lowLiquidityFloor: LOW_LIQUIDITY_FLOOR,
    safetyBuffer: params.safetyBuffer,
    spendableCash: spendableCash != null ? Math.round(spendableCash * 100) / 100 : null,
    visualSpendableCash: visualSpendableCash != null ? Math.round(visualSpendableCash * 100) / 100 : null,
    checkingTotal: Math.round(checkingTotal * 100) / 100,
    creditCardDebt: Math.round(creditCardDebt * 100) / 100,
    goalCompleted,
    escrowTotal: Math.round(escrowTotal * 100) / 100,
    weightedEscrowBite: Math.round(weightedEscrowBite * 100) / 100,
    escrowedBills,
    goalPacing,
    isPlaceholder,
  }
}
