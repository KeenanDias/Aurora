"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { Check, Unlink, Loader2, Flame, Info } from "lucide-react"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { PlaidLinkButton } from "@/components/plaid-link-button"
import confetti from "canvas-confetti"

export function DashboardContent({
  bankLinked: initialBankLinked,
  hasVaultData: initialHasVaultData,
  goalDescription,
  goalAmount,
  goalDeadline,
  goalSaved,
  goalStatus: initialGoalStatus,
  safetyBuffer: initialBuffer,
  points: initialPoints,
  pointsStreak: initialStreak,
  longestStreak: initialLongestStreak,
}: {
  bankLinked: boolean
  hasVaultData?: boolean
  goalDescription?: string
  goalAmount?: number
  goalDeadline?: string
  goalSaved?: number
  goalStatus?: string
  safetyBuffer?: number
  points?: number
  pointsStreak?: number
  longestStreak?: number
}) {
  const [goal, setGoal] = useState({
    description: goalDescription,
    amount: goalAmount,
    deadline: goalDeadline,
    saved: goalSaved ?? 0,
    status: initialGoalStatus ?? "active",
  })
  const [safetyBuffer, setSafetyBuffer] = useState(initialBuffer ?? 0)
  const [bankLinked, setBankLinked] = useState(initialBankLinked)
  const [hasVaultData, setHasVaultData] = useState(initialHasVaultData ?? false)
  const [points, setPoints] = useState(initialPoints ?? 0)
  const [streak, setStreak] = useState(initialStreak ?? 0)
  const [longestStreak, setLongestStreak] = useState(initialLongestStreak ?? 0)
  const confettiFired = useRef(false)

  // Fire confetti when goal is completed
  useEffect(() => {
    if (goal.status === "completed" && goal.amount && goal.saved >= goal.amount && !confettiFired.current) {
      confettiFired.current = true
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#34d399", "#2dd4bf", "#818cf8", "#fbbf24"],
      })
    }
  }, [goal.status, goal.amount, goal.saved])

  // Refetch profile when Aurora updates it via chat
  useEffect(() => {
    const handleProfileUpdate = async () => {
      try {
        const res = await fetch("/api/chat/profile")
        if (res.ok) {
          const data = await res.json()
          const newGoalStatus = data.goal_status ?? "active"
          const prevStatus = goal.status

          setGoal({
            description: data.goal_description,
            amount: data.goal_amount,
            deadline: data.goal_deadline,
            saved: data.goal_saved ?? 0,
            status: newGoalStatus,
          })
          setSafetyBuffer(data.safety_buffer ?? 0)
          setPoints(data.points ?? 0)
          setStreak(data.points_streak ?? 0)
          setLongestStreak(data.longest_streak ?? 0)
          if (data.bank_linked !== undefined) setBankLinked(data.bank_linked)

          // Fire confetti on fresh completion
          if (newGoalStatus === "completed" && prevStatus !== "completed") {
            confettiFired.current = false
          }
        }
      } catch {
        // silent fail
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refresh = (window as any).__refreshDashboardMetrics
      if (typeof refresh === "function") refresh()
    }

    const handleVaultUpdate = () => {
      setHasVaultData(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refresh = (window as any).__refreshDashboardMetrics
      if (typeof refresh === "function") refresh()
    }

    window.addEventListener("aurora-profile-updated", handleProfileUpdate)
    window.addEventListener("aurora-vault-updated", handleVaultUpdate)
    return () => {
      window.removeEventListener("aurora-profile-updated", handleProfileUpdate)
      window.removeEventListener("aurora-vault-updated", handleVaultUpdate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePlaidSuccess = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refresh = (window as any).__refreshDashboardMetrics
    if (typeof refresh === "function") refresh()
    setTimeout(() => window.location.reload(), 1500)
  }, [])

  const progress = goal.amount ? Math.min(100, Math.round((goal.saved / goal.amount) * 100)) : 0
  const isGoalCompleted = goal.status === "completed" || (goal.amount != null && goal.saved >= goal.amount)

  return (
    <>
      {/* Metrics cards */}
      <DashboardMetrics bankLinked={bankLinked} hasVaultData={hasVaultData} />

      {/* Financial Karma + Goal progress row */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {/* Financial Karma */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs text-white/40 font-medium">Financial Karma</span>
            <span className="relative group ml-auto">
              <Info className="w-3.5 h-3.5 text-white/20 cursor-help" />
              <span className="absolute bottom-full right-0 mb-1.5 px-3 py-2 rounded-lg bg-[#1a2235] border border-white/10 text-[10px] text-white/70 w-56 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {bankLinked
                  ? "Earn Karma by staying on budget daily (+10), weekly streaks (+50), goal milestones (+100), and Big Bill weeks (+20). Redemption coming soon!"
                  : "Financial Karma is a Plaid-only perk. Link your bank to start earning rewards for staying on budget."
                }
              </span>
            </span>
          </div>

          {bankLinked ? (
            <>
              <p className="text-2xl font-bold text-white mb-1">
                {points.toLocaleString()} <span className="text-sm font-normal text-white/30">pts</span>
              </p>
              <div className="flex items-center gap-3 text-xs text-white/30">
                <span>{streak}-day streak</span>
                <span className="text-white/10">·</span>
                <span>Best: {longestStreak} days</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-white/20 mb-1">—</p>
              <p className="text-xs text-white/30">Link your bank to unlock Financial Karma</p>
            </>
          )}
        </div>

        {/* Goal progress */}
        {goal.amount && goal.deadline ? (
          <div className={`rounded-xl border p-5 ${
            isGoalCompleted
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : "border-white/[0.06] bg-white/[0.02]"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/60">
                {isGoalCompleted ? "Goal Reached!" : goal.description || "Savings Goal"}
              </p>
              <p className="text-xs text-white/30">
                {isGoalCompleted
                  ? "Completed"
                  : `by ${new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
              </p>
            </div>
            <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isGoalCompleted
                    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/30 mt-2">
              {isGoalCompleted
                ? `$${goal.saved.toLocaleString()} saved — savings returned to your daily limit`
                : `$${goal.saved.toLocaleString()} of $${goal.amount.toLocaleString()} saved — ${progress}%`}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-center">
            <p className="text-sm text-white/30">No goal set yet — chat with Aurora to set your first savings goal</p>
          </div>
        )}
      </div>

      {/* Safety buffer persona message */}
      {bankLinked && safetyBuffer > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 mb-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <p className="text-sm text-white/60">
            Your safety buffer is holding strong — nice work keeping that shield up!
          </p>
        </div>
      )}

      {/* Getting started / Bank connection card */}
      {!bankLinked ? (
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-teal-500/[0.03] to-violet-500/[0.04] p-8">
          <h2 className="text-xl font-bold text-white mb-2">
            Connect Your Bank
          </h2>
          <p className="text-white/40 mb-6 max-w-lg">
            Link your bank account to unlock real-time Safe-to-Spend tracking,
            spending insights, Financial Karma rewards, and personalized AI coaching.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <PlaidLinkButton onSuccess={handlePlaidSuccess} />
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-white/60 font-medium text-sm hover:bg-white/[0.04] transition-all">
              Take a Tour
            </button>
          </div>
        </div>
      ) : (
        <BankConnectedCard />
      )}
    </>
  )
}

function BankConnectedCard() {
  const [unlinking, setUnlinking] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const handleUnlink = async () => {
    setUnlinking(true)
    const res = await fetch("/api/plaid/unlink", { method: "POST" })
    if (res.ok) {
      window.location.reload()
    } else {
      setUnlinking(false)
      setConfirm(false)
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Bank Connected</p>
            <p className="text-xs text-white/40">
              Your metrics update automatically. Chat with Aurora for insights.
            </p>
          </div>
        </div>

        {confirm ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUnlink}
              disabled={unlinking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
            >
              {unlinking ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Unlink className="w-3 h-3" />
              )}
              {unlinking ? "Unlinking..." : "Confirm"}
            </button>
            <button
              onClick={() => setConfirm(false)}
              disabled={unlinking}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs font-medium hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs font-medium hover:bg-white/[0.04] hover:text-white/60 transition-all"
          >
            <Unlink className="w-3 h-3" />
            Unlink Bank
          </button>
        )}
      </div>
    </div>
  )
}
