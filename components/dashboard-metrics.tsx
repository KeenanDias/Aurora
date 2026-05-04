"use client"

import { useState, useEffect, useCallback } from "react"
import { DollarSign, BarChart3, Target, Wallet, Shield, Info, Lock, Link2, FileText, Sparkles, Check } from "lucide-react"

type Metrics = {
  safeToSpend: {
    dailySafeToSpend: number
    remainingBudget: number
    monthlyAvailable: number
    monthlySavingsGoal: number
    daysRemaining: number
    spentThisMonth: number
    isOverBudget: boolean
    safetyBuffer: number
    spendableCash: number | null
    visualSpendableCash: number | null
    checkingTotal: number
    creditCardDebt: number
    goalCompleted?: boolean
    escrowTotal?: number
    escrowedBills?: { name: string; amount: number; dueDate: string }[]
    isPlaceholder?: boolean
  }
  income?: {
    selfReported: number
    observed: number
    used: number
    usingObserved: boolean
  }
  totalBalance: number
  spentThisMonth: number
  fixedBills: number
  spendingByCategory?: Record<string, number>
} | null

// Category display names and colors
const CATEGORY_COLORS: Record<string, { label: string; color: string }> = {
  FOOD_AND_DRINK: { label: "Food & Drink", color: "bg-orange-500" },
  RENT_AND_UTILITIES: { label: "Rent & Utilities", color: "bg-blue-500" },
  TRANSPORTATION: { label: "Transport", color: "bg-yellow-500" },
  SHOPPING: { label: "Shopping", color: "bg-pink-500" },
  ENTERTAINMENT: { label: "Entertainment", color: "bg-purple-500" },
  RECREATION: { label: "Recreation", color: "bg-teal-500" },
  GENERAL_MERCHANDISE: { label: "General", color: "bg-slate-500" },
  PERSONAL_CARE: { label: "Personal Care", color: "bg-rose-500" },
  GENERAL_SERVICES: { label: "Services", color: "bg-indigo-500" },
  INSURANCE: { label: "Insurance", color: "bg-cyan-500" },
}

function getCategoryInfo(key: string) {
  return CATEGORY_COLORS[key] ?? { label: key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), color: "bg-white/20" }
}

export function DashboardMetrics({ bankLinked, hasVaultData, goalSet }: { bankLinked: boolean; hasVaultData?: boolean; goalSet?: boolean }) {
  const [metrics, setMetrics] = useState<Metrics>(null)
  const [loading, setLoading] = useState(false)

  const fetchMetrics = useCallback(async () => {
    if (!bankLinked && !hasVaultData) return
    setLoading(true)
    try {
      const res = await fetch("/api/plaid/sync-transactions")
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [bankLinked, hasVaultData])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    if (!bankLinked && !hasVaultData) return
    const interval = setInterval(() => { fetchMetrics() }, 60_000)
    return () => clearInterval(interval)
  }, [bankLinked, hasVaultData, fetchMetrics])

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__refreshDashboardMetrics = fetchMetrics
    }
  }, [fetchMetrics])

  // BroadcastChannel — preferred sync mechanism. Survives unmount/remount and
  // works across tabs. The window pointer above stays as a fallback.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel("aurora")
    const handler = (e: MessageEvent) => {
      const t = e.data?.type
      if (t === "spending-updated" || t === "profile-updated" || t === "vault-updated") {
        fetchMetrics()
      }
    }
    ch.addEventListener("message", handler)
    return () => {
      ch.removeEventListener("message", handler)
      ch.close()
    }
  }, [fetchMetrics])

  const bufferAmount = metrics?.safeToSpend.safetyBuffer ?? 0
  const visualCash = metrics?.safeToSpend.visualSpendableCash
  const usingObserved = metrics?.income?.usingObserved ?? false
  const escrowTotal = metrics?.safeToSpend.escrowTotal ?? 0
  const escrowedBills = metrics?.safeToSpend.escrowedBills ?? []

  const cards = [
    {
      icon: DollarSign,
      label: "Daily Safe-to-Spend",
      value: metrics
        ? `$${metrics.safeToSpend.dailySafeToSpend.toFixed(0)}`
        : "—",
      desc: metrics
        ? escrowTotal > 0
          ? `$${metrics.safeToSpend.remainingBudget.toFixed(0)} left · $${escrowTotal} escrowed`
          : `$${metrics.safeToSpend.remainingBudget.toFixed(0)} left this month`
        : (bankLinked || hasVaultData)
        ? "Loading..."
        : "Connect bank to see",
      gradient: "from-emerald-400 to-emerald-600",
      alert: metrics?.safeToSpend.isOverBudget,
      incomeAdjusted: usingObserved,
      tooltip: "How much you can spend today without breaking your monthly plan. We take your remaining budget (income minus fixed bills, savings goal, and any bills due in the next 7 days) and divide by the days left in the month.",
    },
    {
      icon: Wallet,
      label: "Spendable Cash",
      value: metrics && visualCash != null
        ? `$${visualCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "—",
      desc: metrics && visualCash != null
        ? `After $${bufferAmount} buffer${escrowTotal > 0 ? ` + $${escrowTotal} escrow` : ""}`
        : "Link bank to see",
      gradient: "from-cyan-400 to-cyan-600",
      alert: visualCash != null && visualCash < 0,
      tooltip: "The real cash you can touch right now: your checking balance minus credit card debt, your safety buffer, and any escrowed bills. If this is negative, you're already overspending.",
    },
    {
      icon: BarChart3,
      label: "Spent This Month",
      value: metrics ? `$${metrics.spentThisMonth.toFixed(0)}` : "—",
      desc: metrics
        ? `$${metrics.fixedBills.toFixed(0)} in fixed bills`
        : "No data yet",
      gradient: "from-orange-400 to-orange-600",
      tooltip: "Total outflow from your linked accounts this calendar month, including both fixed bills (rent, insurance, subscriptions) and discretionary spending (food, shopping, etc.).",
    },
    {
      icon: Target,
      label: "Monthly Goal Savings",
      value: metrics
        ? metrics.safeToSpend.goalCompleted
          ? "Done!"
          : `$${metrics.safeToSpend.monthlySavingsGoal.toFixed(0)}`
        : "—",
      desc: metrics
        ? metrics.safeToSpend.goalCompleted
          ? "Goal completed — savings returned to daily limit"
          : `${metrics.safeToSpend.daysRemaining} days left this month`
        : "Set your first goal",
      gradient: metrics?.safeToSpend.goalCompleted ? "from-emerald-400 to-emerald-600" : "from-violet-400 to-violet-600",
      tooltip: "How much you need to set aside this month to hit your savings goal on time. Calculated from (goal amount − already saved) ÷ months until your deadline. Once the goal is hit, this drops to $0 and that money returns to your daily limit.",
    },
    {
      icon: Shield,
      label: "Safety Buffer",
      value: metrics
        ? `$${bufferAmount.toLocaleString()}`
        : "—",
      desc: metrics
        ? bufferAmount > 0
          ? "Protected — don't touch this"
          : "No buffer set — chat with Aurora to add one"
        : "Set via Aurora chat",
      gradient: "from-indigo-400 to-violet-600",
      tooltip: "An emergency reserve carved out of your spendable cash. Aurora ignores this when calculating your daily limit so you always have a cushion for surprise expenses. Adjust it anytime in chat.",
    },
  ]

  // Spending by category data
  const categoryData = metrics?.spendingByCategory
    ? Object.entries(metrics.spendingByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
    : []
  const categoryTotal = categoryData.reduce((s, [, v]) => s + v, 0)

  // ── Setup Pending state ─────────────────────────────────────────────
  // No bank, no vault, nothing to compute from. Replace the $0.00 ghost-town
  // with a 3-step setup card so the user knows exactly what to do next.
  const isSetupPending = !bankLinked && !hasVaultData
  if (isSetupPending) {
    const steps = [
      {
        icon: Link2,
        title: "Link your bank",
        body: "Most accurate Safe-to-Spend. Plaid only — read-only, never stores credentials.",
        done: false,
        primary: true,
        action: "plaid",
      },
      {
        icon: FileText,
        title: "Or upload a statement",
        body: "PDF bank statement works too. Encrypted in your private vault.",
        done: hasVaultData ?? false,
        primary: false,
        action: "upload",
      },
      {
        icon: Target,
        title: "Set your first goal",
        body: "Tell Aurora in chat — \"I want to save $5K for a car by December.\"",
        done: !!goalSet,
        primary: false,
        action: "goal",
      },
    ]
    const completed = steps.filter((s) => s.done).length
    return (
      <div className="space-y-4 mb-8">
        <div className="glass p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-aurora-emerald/15 via-aurora-teal/10 to-aurora-violet/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet flex items-center justify-center shadow-lg shadow-aurora-teal/30 shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-aurora-teal font-semibold mb-1">Setup Pending</p>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                  Aurora needs a little more to build your number
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Your Daily Safe-to-Spend will unlock as soon as you finish one of the steps below.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{completed} of 3 complete</span>
                <span className="text-xs text-aurora-emerald font-semibold">{Math.round((completed / 3) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet rounded-full transition-all duration-500"
                  style={{ width: `${(completed / 3) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 transition-all ${
                    s.done
                      ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                      : s.primary
                      ? "border-aurora-teal/40 bg-aurora-teal/[0.04] hover:bg-aurora-teal/[0.07]"
                      : "border-border bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        s.done
                          ? "bg-emerald-500/20"
                          : s.primary
                          ? "bg-gradient-to-br from-aurora-emerald to-aurora-teal"
                          : "bg-muted"
                      }`}
                    >
                      {s.done ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <s.icon className={`w-4 h-4 ${s.primary ? "text-white" : "text-foreground/70"}`} />
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Step {i + 1}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Income adjustment notice */}
      {usingObserved && metrics?.income && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-foreground text-sm font-bold">A</span>
          </div>
          <p className="text-sm text-foreground/80">
            Hey! I noticed your bank shows more deposits than the ${metrics.income.selfReported.toLocaleString()} we talked about, so I&apos;ve adjusted your Safe-to-Spend to keep things accurate.
          </p>
        </div>
      )}

      {/* Escrow notice */}
      {escrowedBills.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-sm text-foreground/80">
            Protecting <span className="text-amber-300 font-medium">${escrowTotal}</span> for{" "}
            {escrowedBills.map((b, i) => (
              <span key={b.name}>
                {i > 0 && ", "}
                <span className="text-foreground">{b.name}</span> (due {new Date(b.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
              </span>
            ))}
            {" "}— your daily limit reflects this.
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`glass glass-hover p-5 ${
            card.alert ? "border-red-500/40 bg-red-500/[0.06]" : ""
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-8 h-8 bg-gradient-to-br ${card.gradient} rounded-lg flex items-center justify-center`}
            >
              <card.icon className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {card.label}
            </span>
            <span className="relative group ml-auto">
              <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
              <span className="absolute bottom-full right-0 mb-1.5 px-3 py-2 rounded-lg bg-popover border border-border text-[10px] text-foreground/80 leading-relaxed w-60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {card.tooltip}
              </span>
            </span>
          </div>
          <p
            className={`text-2xl font-bold mb-1 ${
              card.alert ? "text-red-400" : "text-foreground"
            } ${loading ? "animate-pulse" : ""}`}
          >
            {card.value}
          </p>
          <p className="text-xs text-muted-foreground/70">{card.desc}</p>
        </div>
      ))}
      </div>

      {/* Spending breakdown */}
      {categoryData.length > 0 && (
        <div className="glass p-5">
          <h3 className="text-sm font-medium text-foreground/80 mb-4">Where your money went this month</h3>

          {/* Stacked bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex mb-4">
            {categoryData.map(([key, amount]) => {
              const info = getCategoryInfo(key)
              const pct = categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0
              return (
                <div
                  key={key}
                  className={`${info.color} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${info.label}: $${amount.toFixed(0)}`}
                />
              )
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoryData.map(([key, amount]) => {
              const info = getCategoryInfo(key)
              const pct = categoryTotal > 0 ? Math.round((amount / categoryTotal) * 100) : 0
              return (
                <div key={key} className="flex flex-col gap-1.5 rounded-lg bg-muted/40 border border-border/40 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${info.color} shrink-0`} />
                    <span className="text-xs text-foreground/80 truncate">{info.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-foreground">${amount.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
