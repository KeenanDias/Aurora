"use client"

import { useState, useEffect, useCallback } from "react"
import { DollarSign, BarChart3, Target, Wallet, Shield, Info } from "lucide-react"

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
} | null

export function DashboardMetrics({ bankLinked }: { bankLinked: boolean }) {
  const [metrics, setMetrics] = useState<Metrics>(null)
  const [loading, setLoading] = useState(false)

  const fetchMetrics = useCallback(async () => {
    if (!bankLinked) return
    setLoading(true)
    try {
      const res = await fetch("/api/plaid/sync-transactions")
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch {
      // silent fail — metrics just show placeholders
    } finally {
      setLoading(false)
    }
  }, [bankLinked])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Expose refresh for parent components
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__refreshDashboardMetrics = fetchMetrics
    }
  }, [fetchMetrics])

  const bufferAmount = metrics?.safeToSpend.safetyBuffer ?? 0
  const visualCash = metrics?.safeToSpend.visualSpendableCash
  const usingObserved = metrics?.income?.usingObserved ?? false

  const cards = [
    {
      icon: DollarSign,
      label: "Daily Safe-to-Spend",
      value: metrics
        ? `$${metrics.safeToSpend.dailySafeToSpend.toFixed(0)}`
        : "—",
      desc: metrics
        ? `$${metrics.safeToSpend.remainingBudget.toFixed(0)} left this month`
        : bankLinked
        ? "Loading..."
        : "Connect bank to see",
      gradient: "from-emerald-400 to-emerald-600",
      alert: metrics?.safeToSpend.isOverBudget,
      incomeAdjusted: usingObserved,
    },
    {
      icon: Wallet,
      label: "Spendable Cash",
      value: metrics && visualCash != null
        ? `$${visualCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "—",
      desc: metrics && visualCash != null
        ? `After $${bufferAmount} safety buffer`
        : "Link bank to see",
      gradient: "from-cyan-400 to-cyan-600",
      alert: visualCash != null && visualCash < 0,
    },
    {
      icon: BarChart3,
      label: "Spent This Month",
      value: metrics ? `$${metrics.spentThisMonth.toFixed(0)}` : "—",
      desc: metrics
        ? `$${metrics.fixedBills.toFixed(0)} in fixed bills`
        : "No data yet",
      gradient: "from-orange-400 to-orange-600",
    },
    {
      icon: Target,
      label: "Monthly Goal Savings",
      value: metrics
        ? `$${metrics.safeToSpend.monthlySavingsGoal.toFixed(0)}`
        : "—",
      desc: metrics
        ? `${metrics.safeToSpend.daysRemaining} days left this month`
        : "Set your first goal",
      gradient: "from-violet-400 to-violet-600",
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
    },
  ]

  return (
    <div className="space-y-4 mb-8">
      {/* Income adjustment notice */}
      {usingObserved && metrics?.income && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <p className="text-sm text-white/60">
            Hey! I noticed your bank shows more deposits than the ${metrics.income.selfReported.toLocaleString()} we talked about, so I&apos;ve adjusted your Safe-to-Spend to keep things accurate based on your real cash flow.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`p-5 rounded-xl border bg-white/[0.02] ${
            card.alert
              ? "border-red-500/30 bg-red-500/[0.04]"
              : "border-white/[0.06]"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-8 h-8 bg-gradient-to-br ${card.gradient} rounded-lg flex items-center justify-center`}
            >
              <card.icon className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs text-white/40 font-medium">
              {card.label}
            </span>
            {card.incomeAdjusted && (
              <span className="relative group">
                <Info className="w-3.5 h-3.5 text-teal-400/60 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a2235] border border-white/10 text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Based on recent bank activity
                </span>
              </span>
            )}
          </div>
          <p
            className={`text-2xl font-bold mb-1 ${
              card.alert ? "text-red-400" : "text-white"
            } ${loading ? "animate-pulse" : ""}`}
          >
            {card.value}
          </p>
          <p className="text-xs text-white/30">{card.desc}</p>
        </div>
      ))}
      </div>
    </div>
  )
}
