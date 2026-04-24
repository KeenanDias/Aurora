"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Unlink, Loader2 } from "lucide-react"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { PlaidLinkButton } from "@/components/plaid-link-button"

export function DashboardContent({
  bankLinked: initialBankLinked,
  hasVaultData: initialHasVaultData,
  goalDescription,
  goalAmount,
  goalDeadline,
  goalSaved,
  safetyBuffer: initialBuffer,
}: {
  bankLinked: boolean
  hasVaultData?: boolean
  goalDescription?: string
  goalAmount?: number
  goalDeadline?: string
  goalSaved?: number
  safetyBuffer?: number
}) {
  const [goal, setGoal] = useState({
    description: goalDescription,
    amount: goalAmount,
    deadline: goalDeadline,
    saved: goalSaved ?? 0,
  })
  const [safetyBuffer, setSafetyBuffer] = useState(initialBuffer ?? 0)
  const [bankLinked, setBankLinked] = useState(initialBankLinked)
  const [hasVaultData, setHasVaultData] = useState(initialHasVaultData ?? false)

  // Refetch profile when Aurora updates it via chat
  useEffect(() => {
    const handleProfileUpdate = async () => {
      try {
        const res = await fetch("/api/chat/profile")
        if (res.ok) {
          const data = await res.json()
          setGoal({
            description: data.goal_description,
            amount: data.goal_amount,
            deadline: data.goal_deadline,
            saved: data.goal_saved ?? 0,
          })
          setSafetyBuffer(data.safety_buffer ?? 0)
          if (data.bank_linked !== undefined) setBankLinked(data.bank_linked)
        }
      } catch {
        // silent fail
      }
      // Also refresh metrics
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
  }, [])

  const handlePlaidSuccess = useCallback(() => {
    // Trigger metrics refresh after bank link
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refresh = (window as any).__refreshDashboardMetrics
    if (typeof refresh === "function") {
      refresh()
    }
    // Reload to update server-side bank_linked status
    setTimeout(() => window.location.reload(), 1500)
  }, [])

  return (
    <>
      {/* Metrics cards */}
      <DashboardMetrics bankLinked={bankLinked} hasVaultData={hasVaultData} />

      {/* Goal progress (if set) */}
      {goal.amount && goal.deadline && (() => {
        const progress = Math.min(100, Math.round((goal.saved / goal.amount) * 100))
        return (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/60">
                {goal.description || "Savings Goal"}
              </p>
              <p className="text-xs text-white/30">
                by {new Date(goal.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-white/30 mt-2">
              ${goal.saved.toLocaleString()} of ${goal.amount.toLocaleString()} saved — {progress}%
            </p>
          </div>
        )
      })()}

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
            spending insights, and personalized AI coaching from Aurora.
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
