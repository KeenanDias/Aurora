"use client"

import { useState, useEffect, useCallback } from "react"
import { DollarSign, BarChart3, Target, TrendingDown } from "lucide-react"

type Metrics = {
  safeToSpend: {
    dailySafeToSpend: number
    remainingBudget: number
    monthlyAvailable: number
    monthlySavingsGoal: number
    daysRemaining: number
    spentThisMonth: number
    isOverBudget: boolean
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
    },
    {
      icon: BarChart3,
      label: "Spent This Month",
      value: metrics ? `$${metrics.spentThisMonth.toFixed(0)}` : "—",
      desc: metrics
        ? `$${metrics.fixedBills.toFixed(0)} in fixed bills`
        : "No data yet",
      gradient: "from-cyan-400 to-cyan-600",
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
      icon: TrendingDown,
      label: "Account Balance",
      value: metrics ? `$${metrics.totalBalance.toFixed(0)}` : "—",
      desc: metrics ? "Across linked accounts" : "Link bank to see",
      gradient: "from-teal-400 to-teal-600",
    },
  ]

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
  )
}
