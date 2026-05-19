"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Check, Unlink, Loader2, FileText, Clock } from "lucide-react"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { DashboardTabs } from "@/components/dashboard-tabs"
import { StreakIndicator } from "@/components/streak-indicator"
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
  const confettiFired = useRef(false)
  // Karma state removed — replaced by the global <StreakIndicator />, which
  // owns its own fetch and broadcast subscription. initialPoints/Streak
  // props are still accepted for backwards-compat with the dashboard page
  // but are no longer mirrored into local state.
  void initialPoints
  void initialStreak
  void initialLongestStreak

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

  // Plaid Link is gated during the beta — see the bank-connection card
  // below. When production approval lands, restore PlaidLinkButton and
  // its onSuccess handler that refreshes the dashboard metrics.

  return (
    <>
      {/* Metrics cards */}
      <DashboardMetrics bankLinked={bankLinked} hasVaultData={hasVaultData} goalSet={!!goal.amount} />

      {/* Safety buffer persona message */}
      {bankLinked && safetyBuffer > 0 && (
        <div className="glass p-4 mb-6 flex items-center gap-3 !border-indigo-500/30">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-foreground text-sm font-bold">A</span>
          </div>
          <p className="text-sm text-foreground/80">
            Your safety buffer is holding strong — nice work keeping that shield up!
          </p>
        </div>
      )}

      {/* Global Budget Streak indicator */}
      <div className="mb-6">
        <StreakIndicator />
      </div>

      {/* Tabbed dashboard content */}
      <div className="mb-8">
        <DashboardTabs
          goal={goal}
          bankLinked={bankLinked}
          hasVaultData={hasVaultData}
        />
      </div>

      {/* Bank connection card */}
      {!bankLinked ? (
        <div className="glass p-8 bg-gradient-to-br from-amber-500/[0.06] via-aurora-teal/[0.04] to-aurora-violet/[0.06] !border-amber-500/30">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-1">
                Beta · Bank Linking Coming Soon
              </p>
              <h2 className="text-xl font-bold text-foreground leading-tight">
                Live bank sync isn&apos;t enabled yet
              </h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
            We&apos;re still finishing our Plaid production approval. In the
            meantime, upload a recent PDF bank statement to your Vault — Aurora
            will parse your real transactions, fixed bills, and balances so
            every dashboard number (Safe-to-Spend, Categories, Streak) reflects
            your actual spending.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/vault"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet text-white text-sm font-semibold shadow-lg shadow-aurora-teal/30 hover:shadow-xl hover:shadow-aurora-teal/40 transition-all"
            >
              <FileText className="w-4 h-4" />
              Upload a Bank Statement
            </Link>
            <span className="text-xs text-muted-foreground/80">
              Encrypted in your private vault · PDF only · We never store credentials
            </span>
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
    <div className="glass p-6 !border-emerald-500/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Check className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Bank Connected</p>
            <p className="text-xs text-muted-foreground">
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
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted/60 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted/60 hover:text-foreground/80 transition-all"
          >
            <Unlink className="w-3 h-3" />
            Unlink Bank
          </button>
        )}
      </div>
    </div>
  )
}
