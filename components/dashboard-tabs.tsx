"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import {
  Target,
  PieChart as PieIcon,
  Sparkles,
  Trophy,
  ChevronDown,
  Utensils,
  Film,
  Home,
  Car,
  CreditCard,
  ShoppingBag,
  HeartPulse,
  Briefcase,
  Wrench,
  Receipt,
  Plus,
  Loader2,
  X,
  Pencil,
  Pause,
  Play,
  TrendingUp,
  Zap,
  Calendar,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts"
import confetti from "canvas-confetti"
import type { LucideIcon } from "lucide-react"

// ──────────────────────────────────────────────────────────────────────
// Shared types + helpers
// ──────────────────────────────────────────────────────────────────────

type TabId = "goals" | "categories"

type Goal = {
  description?: string
  amount?: number
  deadline?: string
  saved: number
  status: string
}

type Metrics = {
  safeToSpend: {
    dailySafeToSpend: number
    remainingBudget: number
    daysRemaining: number
    isOverBudget: boolean
    monthlyAvailable: number
  }
  spentThisMonth: number
  fixedBills: number
  spendingByCategory?: Record<string, number>
  // Per-category transactions list, pre-filtered server-side using the
  // SAME `realSpending` set that feeds spendingByCategory. So the
  // summary number and the expanded list always reconcile.
  transactionsByCategory?: Record<string, { name: string; amount: number; date: string }[]>
  recentTransactions?: { name: string; amount: number; date: string; category?: string }[]
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  FOOD_AND_DRINK: { label: "Food & Dining", color: "#fb923c", icon: Utensils },
  RENT_AND_UTILITIES: { label: "Housing & Utilities", color: "#60a5fa", icon: Home },
  TRANSPORTATION: { label: "Transport", color: "#facc15", icon: Car },
  SHOPPING: { label: "Shopping", color: "#f472b6", icon: ShoppingBag },
  ENTERTAINMENT: { label: "Entertainment", color: "#a855f7", icon: Film },
  RECREATION: { label: "Recreation", color: "#2dd4bf", icon: HeartPulse },
  GENERAL_MERCHANDISE: { label: "General", color: "#94a3b8", icon: Briefcase },
  PERSONAL_CARE: { label: "Personal Care", color: "#fb7185", icon: HeartPulse },
  GENERAL_SERVICES: { label: "Services", color: "#818cf8", icon: Wrench },
  INSURANCE: { label: "Insurance", color: "#06b6d4", icon: Receipt },
  LOAN_PAYMENTS: { label: "Debt Payments", color: "#f43f5e", icon: CreditCard },
}

function categoryMeta(key: string) {
  return (
    CATEGORY_META[key] ?? {
      label: key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
      color: "#64748b",
      icon: Briefcase,
    }
  )
}

// ──────────────────────────────────────────────────────────────────────
// Top-level tab container
// ──────────────────────────────────────────────────────────────────────

export function DashboardTabs({
  goal,
  bankLinked,
  hasVaultData,
  onClaimGoal,
}: {
  goal: Goal
  bankLinked: boolean
  hasVaultData: boolean
  onClaimGoal?: () => void
}) {
  const [tab, setTab] = useState<TabId>("goals")
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!bankLinked && !hasVaultData) return
    try {
      const res = await fetch("/api/plaid/sync-transactions")
      if (res.ok) setMetrics(await res.json())
    } catch {
      // silent
    }
  }, [bankLinked, hasVaultData])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  // Stay synced with chat-driven updates.
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

  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "goals", label: "Goals", icon: Target },
    { id: "categories", label: "Categories", icon: PieIcon },
  ]

  return (
    <div className="space-y-6">
      {/* Pill-style tab navigation */}
      <div role="tablist" className="inline-flex p-1 rounded-full border border-border bg-muted/40 backdrop-blur-md gap-1 max-w-full overflow-x-auto">
        {tabs.map((t) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors shrink-0 z-0"
            >
              {active && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet shadow-lg shadow-aurora-teal/30 -z-10"
                  transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.6 }}
                />
              )}
              <Icon className={`w-4 h-4 ${active ? "text-white" : "text-muted-foreground"}`} />
              <span className={active ? "text-white" : "text-muted-foreground"}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content with fly-through transition */}
      <div className="relative min-h-[420px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {tab === "goals" && <GoalsTab goal={goal} onClaim={onClaimGoal} />}
            {tab === "categories" && <CategoriesTab metrics={metrics} bankLinked={bankLinked} hasVaultData={hasVaultData} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// (Karma tab removed — replaced by the global Budget-Streak indicator
// rendered above the dashboard tabs. See components/streak-indicator.tsx
// and lib/streaks.ts.)
// ──────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────
// Tab 1 — Goals (multi-goal lineup)
// ──────────────────────────────────────────────────────────────────────

type GoalRow = {
  id: string
  description: string
  amount: number
  saved: number
  deadline: string | null
  emoji: string | null
  status: string
  is_primary: boolean
  is_enrolled?: boolean
  monthly_bite?: number
  daily_bite?: number
  created_at: string | null
}

function broadcast(payload: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
  try {
    const ch = new BroadcastChannel("aurora")
    ch.postMessage(payload)
    ch.close()
  } catch {
    // swallow
  }
}

type Toast = { id: string; tone: "success" | "warning"; message: string }

function GoalsTab({ goal, onClaim }: { goal: Goal; onClaim?: () => void }) {
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [listening, setListening] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = useCallback((tone: Toast["tone"], message: string) => {
    const id = `t-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, tone, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals")
      if (res.ok) {
        const data = await res.json()
        setGoals(data.goals ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // Listen for chat-driven goal events.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel("aurora")
    const handler = async (e: MessageEvent) => {
      const t = e.data?.type
      if (t === "intent-progress" && e.data?.intent === "ADD_GOAL") {
        setListening(true)
      }
      if (t === "intent-cancel" && e.data?.intent === "ADD_GOAL") {
        setListening(false)
      }
      if (t === "goal-created") {
        setListening(false)
        await fetchGoals()
        if (e.data?.goalId) setJustAddedId(e.data.goalId as string)
        // Pop animation lasts ~600ms; clear so re-renders don't keep popping.
        setTimeout(() => setJustAddedId(null), 1200)
      }
      if (t === "goal-updated") {
        await fetchGoals()
      }
      if (t === "goal-enrollment-changed") {
        await fetchGoals()
        const enrolled = e.data?.enrolled as boolean
        const name = (e.data?.description as string) ?? "this goal"
        if (enrolled) {
          pushToast(
            "success",
            `Got it! I've adjusted your daily limit to protect your ${name} savings. You're doing great!`
          )
        } else {
          pushToast(
            "success",
            `${name} is now tracking-only — your daily limit just opened back up.`
          )
        }
      }
      if (t === "low-liquidity-warning") {
        pushToast(
          "warning",
          "Heads up! Enrolling all these goals makes your daily limit a bit tight. Are you sure you want to stay this aggressive?"
        )
      }
      if (t === "contribution-verified") {
        const status = e.data?.status as string | undefined
        const message = (e.data?.message as string) ?? "Contribution logged."
        pushToast(status === "unverified" ? "warning" : "success", message)
      }
    }
    ch.addEventListener("message", handler)
    return () => {
      ch.removeEventListener("message", handler)
      ch.close()
    }
  }, [fetchGoals, pushToast])

  const triggerAddGoal = () => {
    setListening(true)
    broadcast({ type: "trigger-intent", intent: "ADD_GOAL" })
  }

  // Optimistic local-state mutation so pause/resume + edits feel instant.
  // Defined unconditionally before any early return — keeps hook order stable.
  const patchLocal = useCallback((id: string, patch: Partial<GoalRow>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }, [])

  // Empty state pre-fetch
  if (loading && goals.length === 0) {
    return (
      <div className="glass p-10 text-center text-sm text-muted-foreground">Loading your goals…</div>
    )
  }

  // No goals — show only the Add card prominently centered, plus the legacy
  // "primary" goal context if present.
  const showLegacyOnly = goals.length === 0 && !!goal.amount

  const visibleGoals = showLegacyOnly
    ? [{
        id: "primary",
        description: goal.description ?? "Savings goal",
        amount: goal.amount!,
        saved: goal.saved,
        deadline: goal.deadline ?? null,
        emoji: "🎯",
        status: goal.status,
        is_primary: true,
        created_at: null,
      } as GoalRow]
    : goals

  const selectedGoal = selectedId ? visibleGoals.find((g) => g.id === selectedId) ?? null : null

  return (
    <>
      <div className="space-y-6">
        {/* Lineup grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Add Goal card — always first */}
          <AddGoalCard
            listening={listening}
            onClick={triggerAddGoal}
            onCancel={() => {
              setListening(false)
              broadcast({ type: "intent-cancel", intent: "ADD_GOAL" })
            }}
          />

          <AnimatePresence initial={false}>
            {visibleGoals.map((g, i) => (
              <motion.div
                key={g.id}
                initial={
                  justAddedId === g.id ? { opacity: 0, scale: 0.5 } : { opacity: 0, y: 16 }
                }
                animate={
                  justAddedId === g.id
                    ? { opacity: 1, scale: 1, transition: { type: "spring", damping: 14, stiffness: 220, mass: 0.8 } }
                    : { opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] } }
                }
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              >
                <GoalCard
                  goal={g}
                  highlight={justAddedId === g.id}
                  onClaim={onClaim}
                  onOpen={() => setSelectedId(g.id)}
                  onLocalPatch={(patch) => patchLocal(g.id, patch)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast stack — top-right, auto-dismiss */}
      {typeof window !== "undefined" &&
        createPortal(
          <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 60, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.95 }}
                  transition={{ type: "spring", damping: 24, stiffness: 280 }}
                  className={`max-w-sm pointer-events-auto rounded-2xl border p-4 backdrop-blur-xl shadow-2xl ${
                    t.tone === "warning"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
                      : "border-aurora-emerald/40 bg-aurora-emerald/15 text-foreground"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${t.tone === "warning" ? "text-amber-300" : "text-aurora-emerald"}`} />
                    <p className="text-sm leading-relaxed">{t.message}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}

      {/* Detail overlay — rendered as a sibling so its fixed positioning works. */}
      <AnimatePresence>
        {selectedGoal && (
          <GoalDetail
            key={selectedGoal.id}
            goal={selectedGoal}
            onClose={() => setSelectedId(null)}
            onClaim={onClaim}
            onLocalPatch={(patch) => patchLocal(selectedGoal.id, patch)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function AddGoalCard({
  listening,
  onClick,
  onCancel,
}: {
  listening: boolean
  onClick: () => void
  onCancel: () => void
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={listening ? undefined : onClick}
        disabled={listening}
        className={`group relative w-full h-full min-h-[220px] rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
          listening
            ? "border-aurora-teal/60 bg-aurora-teal/[0.06] cursor-default"
            : "border-border bg-muted/20 hover:border-aurora-emerald/50 hover:bg-aurora-emerald/[0.04] cursor-pointer"
        }`}
      >
        {/* Glow gradient on hover (or always when listening) */}
        <div
          className={`absolute inset-0 bg-gradient-to-br from-aurora-emerald/0 via-aurora-teal/0 to-aurora-violet/0 transition-opacity ${
            listening
              ? "opacity-100 from-aurora-emerald/20 via-aurora-teal/15 to-aurora-violet/20"
              : "opacity-0 group-hover:opacity-100 group-hover:from-aurora-emerald/20 group-hover:via-aurora-teal/15 group-hover:to-aurora-violet/20"
          }`}
        />

        <div className="relative h-full flex flex-col items-center justify-center p-6 text-center">
          <AnimatePresence mode="wait">
            {listening ? (
              <motion.div
                key="listening"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet flex items-center justify-center shadow-lg shadow-aurora-teal/40">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <span className="absolute inset-0 rounded-2xl ring-2 ring-aurora-teal/40 animate-ping" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Aurora&apos;s building it…</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    Answer the chat questions and your goal will land here.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-muted-foreground/40 group-hover:border-aurora-emerald/60 flex items-center justify-center transition-colors">
                  <Plus className="w-7 h-7 text-muted-foreground/60 group-hover:text-aurora-emerald transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-foreground">Add a new goal</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    Tell Aurora what you&apos;re saving for and she&apos;ll line it up.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>

      {listening && (
        <button
          onClick={onCancel}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-background text-xs flex items-center justify-center transition-colors"
          aria-label="Cancel"
        >
          ×
        </button>
      )}
    </div>
  )
}

function GoalCard({
  goal,
  highlight,
  onClaim,
  onOpen,
  onLocalPatch,
}: {
  goal: GoalRow
  highlight: boolean
  onClaim?: () => void
  onOpen?: () => void
  onLocalPatch?: (patch: Partial<GoalRow>) => void
}) {
  const progress = Math.min(100, Math.round((goal.saved / goal.amount) * 100))
  const isCompleted = goal.status === "completed" || goal.saved >= goal.amount
  const isEnrolled = !!goal.is_enrolled

  const deadlineDate = goal.deadline ? new Date(goal.deadline) : null
  const daysLeft = deadlineDate
    ? Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const [busyToggle, setBusyToggle] = useState(false)

  const toggleEnrollment = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (busyToggle || isCompleted) return
    setBusyToggle(true)
    const next = !isEnrolled
    onLocalPatch?.({ is_enrolled: next })
    try {
      const res = await fetch(`/api/goals/${goal.id}/toggle-enrollment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolled: next }),
      })
      if (!res.ok) throw new Error("toggle failed")
      broadcast({
        type: "goal-enrollment-changed",
        goalId: goal.id,
        enrolled: next,
        description: goal.description,
      } as never)
      // STS will need to recompute.
      broadcast({ type: "profile-updated" })
      // Re-fetch metrics so we can spot a low-liquidity state and nudge.
      try {
        const m = await fetch("/api/plaid/sync-transactions").then((r) =>
          r.ok ? r.json() : null
        )
        if (m?.safeToSpend?.isLowLiquidity) {
          broadcast({ type: "low-liquidity-warning" } as never)
        }
      } catch {
        // non-fatal
      }
    } catch {
      onLocalPatch?.({ is_enrolled: isEnrolled })
    } finally {
      setBusyToggle(false)
    }
  }

  return (
    <div
      onClick={onOpen}
      style={{ cursor: onOpen ? "pointer" : undefined }}
      className={`relative h-full glass p-5 flex flex-col gap-4 transition-all ${
        isCompleted
          ? "!border-emerald-500/40 !bg-emerald-500/[0.06]"
          : highlight
          ? "!border-aurora-teal/50 !bg-aurora-teal/[0.04]"
          : isEnrolled
          ? "!border-aurora-emerald/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
          : ""
      }`}
    >
      {/* Top row — emoji + status pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-3xl leading-none">{goal.emoji ?? "🎯"}</div>
        {goal.is_primary && !isCompleted && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-aurora-emerald/15 text-aurora-emerald font-semibold">
            Primary
          </span>
        )}
        {isCompleted && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
            Reached
          </span>
        )}
      </div>

      {/* Description + numbers */}
      <div className="flex-1 min-h-0">
        <p className="text-sm font-semibold text-foreground line-clamp-2">{goal.description}</p>
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
          ${goal.saved.toLocaleString()} <span className="text-muted-foreground/60">/</span> ${goal.amount.toLocaleString()}
        </p>
      </div>

      {/* Progress bar (small) + ring (compact) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {progress}% complete
          </span>
          {daysLeft != null && !isCompleted && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {daysLeft === 0 ? "due today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </span>
          )}
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${
              isCompleted
                ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                : "bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ boxShadow: "0 0 10px rgba(45, 212, 191, 0.35)" }}
          />
        </div>
      </div>

      {/* Victory lap claim */}
      {isCompleted && (
        <button
          onClick={() => {
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ["#34d399", "#2dd4bf", "#818cf8", "#fbbf24"],
            })
            onClaim?.()
          }}
          className="relative inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full font-medium text-xs overflow-hidden group"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-500" />
          <span className="relative text-white flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            Claim reward
          </span>
        </button>
      )}

      {/* Enrollment toggle — only relevant for non-completed goals */}
      {!isCompleted && (
        <div className="pt-3 border-t border-border/40 -mx-5 px-5 -mb-5 pb-4 mt-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground">
                Enroll in daily limit
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                {isEnrolled
                  ? goal.daily_bite
                    ? `Reserves $${goal.daily_bite.toFixed(2)}/day from your STS.`
                    : "Carving out your daily limit."
                  : "Tracking only — not affecting daily limit."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnrolled}
              disabled={busyToggle}
              onClick={toggleEnrollment}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors backdrop-blur-md border ${
                isEnrolled
                  ? "bg-aurora-emerald/40 border-aurora-emerald/60 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                  : "bg-muted border-border"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  isEnrolled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Goal Detail — full-screen morph of a single goal card
// ──────────────────────────────────────────────────────────────────────

const MILESTONES = [10, 25, 50, 75, 100]

function GoalDetail({
  goal,
  onClose,
  onClaim,
  onLocalPatch,
}: {
  goal: GoalRow
  onClose: () => void
  onClaim?: () => void
  onLocalPatch: (patch: Partial<GoalRow>) => void
}) {
  const [busy, setBusy] = useState<"pause" | "edit" | "log" | null>(null)
  // Local override mirrors the server until the next refetch lands.
  const [status, setStatus] = useState(goal.status)
  const [saved, setSaved] = useState(goal.saved)
  const [logOpen, setLogOpen] = useState(false)
  const [logInput, setLogInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  type Contribution = {
    id: string
    amount: number
    verification_status: "pending" | "verified" | "unverified" | "probable"
    verification_method: string | null
    karma_awarded: boolean
    claimed_at: string
    verified_at: string | null
  }
  const [contributions, setContributions] = useState<Contribution[]>([])

  const refetchContributions = useCallback(async () => {
    try {
      const r = await fetch(`/api/goals/${goal.id}/contributions`)
      if (r.ok) {
        const d = await r.json()
        setContributions(d.contributions ?? [])
      }
    } catch {
      // silent
    }
  }, [goal.id])

  useEffect(() => {
    refetchContributions()
  }, [refetchContributions, saved])

  useEffect(() => {
    setStatus(goal.status)
    setSaved(goal.saved)
  }, [goal.status, goal.saved])

  // Lock background scroll. body overflow: hidden + data-lenis-prevent on
  // the modal's scroll container blocks the global Lenis from touching
  // anything outside.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // Mount a nested Lenis instance on the modal's scroll container so its
  // wheel feel matches the rest of the app (same easing/duration as the
  // global one in LenisProvider). Respects prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === "undefined") return
    const el = scrollRef.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      wrapper: el,
      content: el.firstElementChild as HTMLElement,
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    })

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [])

  // ── Math ───────────────────────────────────────────────────────────
  const progress = Math.min(100, Math.round((saved / goal.amount) * 100))
  const isCompleted = status === "completed" || saved >= goal.amount
  const isPaused = status === "paused"

  const deadlineDate = goal.deadline ? new Date(goal.deadline) : null
  const monthsToDeadline = deadlineDate
    ? Math.max(
        0,
        (deadlineDate.getFullYear() - new Date().getFullYear()) * 12 +
          (deadlineDate.getMonth() - new Date().getMonth())
      )
    : null

  const remaining = Math.max(0, goal.amount - saved)

  // Monthly pace — driven by actual contribution history, not just total
  // saved divided by goal age. The cleaner signal:
  //   - 2+ contributions spanning ≥ 7 days → real rate (sum ÷ span × 30.44)
  //   - 1 contribution or < 7 days → "trickle" pace (sum ÷ daysElapsed × 30.44)
  //     but tagged so the UI can mark it "early signal" rather than reliable.
  //   - no contributions yet → 0, UI shows "Save your first dollar."
  const DAY_MS = 1000 * 60 * 60 * 24
  const startedDate = goal.created_at ? new Date(goal.created_at) : null
  const daysSinceStart = startedDate
    ? Math.max(0, Math.floor((Date.now() - startedDate.getTime()) / DAY_MS))
    : null

  // Use the contribution-history list when we have it. Otherwise fall back
  // to the cumulative `saved` ÷ age math (less honest, but the only signal
  // for legacy goals that pre-date contribution tracking).
  let observedMonthlyPace = 0
  let paceConfidence: "reliable" | "early" | "none" = "none"
  let paceContribCount = 0
  let paceSpanDays = 0

  if (contributions.length > 0) {
    const totalContrib = contributions.reduce((s, c) => s + Number(c.amount), 0)
    paceContribCount = contributions.length
    const sorted = [...contributions].sort(
      (a, b) => new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime()
    )
    const firstAt = new Date(sorted[0].claimed_at).getTime()
    paceSpanDays = Math.max(1, Math.ceil((Date.now() - firstAt) / DAY_MS))
    observedMonthlyPace = (totalContrib / paceSpanDays) * 30.44
    paceConfidence = paceContribCount >= 2 && paceSpanDays >= 7 ? "reliable" : "early"
  } else if (saved > 0 && daysSinceStart != null && daysSinceStart >= 1) {
    // Legacy fallback for goals with `saved > 0` but no logged contributions.
    observedMonthlyPace = (saved / daysSinceStart) * 30.44
    paceConfidence = "early"
  }

  const requiredMonthlyPace = monthsToDeadline && monthsToDeadline > 0 ? remaining / monthsToDeadline : remaining

  // Forecast — at observed pace, when do we hit it? Falls back to deadline-required.
  const effectivePace = isPaused ? 0 : observedMonthlyPace > 0 ? observedMonthlyPace : 0
  const projectedMonths = effectivePace > 0 ? Math.ceil(remaining / effectivePace) : null
  const projectedDate = projectedMonths != null
    ? new Date(new Date().setMonth(new Date().getMonth() + projectedMonths))
    : null

  // STS bite — required monthly pace ÷ days in this month.
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const stsBite = isPaused ? 0 : Math.round((requiredMonthlyPace / daysInMonth) * 100) / 100

  // ── Actions ────────────────────────────────────────────────────────
  const togglePause = async () => {
    if (busy || isCompleted) return
    setBusy("pause")
    const next = isPaused ? "active" : "paused"
    setStatus(next) // optimistic
    onLocalPatch({ status: next })
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error("PATCH failed")
      // Tell the rest of the app to recompute STS.
      broadcast({ type: "profile-updated" })
    } catch {
      // rollback
      setStatus(goal.status)
      onLocalPatch({ status: goal.status })
    } finally {
      setBusy(null)
    }
  }

  const triggerEdit = () => {
    if (busy) return
    setBusy("edit")
    broadcast({ type: "trigger-intent", intent: "EDIT_GOAL", goalId: goal.id, goalDescription: goal.description })
    setBusy(null)
    onClose()
  }

  // Log a contribution. The server inserts a goal_contributions row, runs
  // Plaid-based verification (transfer match → balance growth → pending),
  // and bumps goals.saved cumulatively. Karma is only awarded on verified
  // contributions, with retry via /api/cron/verify-savings.
  const logSavings = async () => {
    if (busy) return
    const delta = Number(logInput.replace(/[^0-9.]/g, ""))
    if (!Number.isFinite(delta) || delta <= 0) return
    setBusy("log")
    const next = Math.min(goal.amount, saved + delta)
    setSaved(next) // optimistic
    onLocalPatch({ saved: next })
    try {
      const res = await fetch(`/api/goals/${goal.id}/log-contribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: delta }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "log failed")
      broadcast({ type: "goal-updated", goalId: goal.id })
      broadcast({ type: "profile-updated" })
      // Surface Aurora's verification reaction as a toast on the dashboard.
      if (typeof data.message === "string") {
        broadcast({
          type: "contribution-verified",
          status: data.contribution?.verification_status,
          message: data.message,
        } as never)
      }
      setLogInput("")
      setLogOpen(false)
    } catch {
      // rollback
      setSaved(goal.saved)
      onLocalPatch({ saved: goal.saved })
    } finally {
      setBusy(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  // Portal to document.body so the panel's `position: fixed` isn't trapped
  // by ancestor `transform`/`filter` (the tab-transition wrapper applies
  // both, which collapses the panel into a thin horizontal strip).
  if (typeof window === "undefined") return null

  return createPortal(
    <>
      {/* Backdrop — click closes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Detail panel — independent scale-up, no shared layoutId (which was
          producing layout-measurement artifacts in the lineup). */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 26, stiffness: 240, mass: 0.7 }}
        className="fixed z-50 inset-3 sm:inset-8 md:inset-16 lg:inset-24 rounded-3xl overflow-hidden border border-aurora-teal/30 shadow-2xl shadow-aurora-teal/20"
      >
        {/* Pulsing aurora mesh behind the panel */}
        <div className="absolute inset-0 bg-background">
          <motion.div
            className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-aurora-emerald/30 via-aurora-teal/25 to-transparent blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-aurora-violet/25 via-aurora-teal/20 to-transparent blur-3xl"
            animate={{ scale: [1.1, 0.95, 1.1], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Glass content layer */}
        <div
          ref={scrollRef}
          data-lenis-prevent
          className="relative h-full bg-background/40 backdrop-blur-xl overflow-y-auto"
        >
         <div className="min-h-full">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-background/60 border border-border hover:bg-background/80 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>

          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="text-6xl leading-none">{goal.emoji ?? "🎯"}</div>
                {goal.is_primary && (
                  <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-aurora-emerald/15 text-aurora-emerald font-semibold">
                    Primary goal
                  </span>
                )}
                {isPaused && (
                  <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-semibold inline-flex items-center gap-1">
                    <Pause className="w-3 h-3" /> Paused
                  </span>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                {goal.description}
              </h2>
              <p className="text-sm text-muted-foreground mt-2 tabular-nums">
                ${goal.saved.toLocaleString()}{" "}
                <span className="text-muted-foreground/60">of</span> ${goal.amount.toLocaleString()}
              </p>
            </div>

            {/* Progress bar (large) */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {progress}% complete
                </span>
                {deadlineDate && !isCompleted && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Target: {deadlineDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    isCompleted
                      ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                      : "bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
                  style={{ boxShadow: "0 0 14px rgba(45, 212, 191, 0.45)" }}
                />
              </div>
            </div>

            {/* Hero math — the headline numbers, big and unmissable. */}
            <div className="rounded-2xl border border-aurora-teal/30 bg-gradient-to-br from-aurora-emerald/[0.08] via-aurora-teal/[0.06] to-aurora-violet/[0.08] backdrop-blur-md p-6 sm:p-8">
              <p className="text-xs uppercase tracking-wider text-aurora-teal font-semibold mb-3">
                The math
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">To stay on track</p>
                  <p className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
                    {isPaused
                      ? "Paused"
                      : isCompleted
                      ? "Done!"
                      : `$${Math.round(requiredMonthlyPace).toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isPaused
                      ? "No monthly contribution while paused."
                      : isCompleted
                      ? "Goal already reached."
                      : monthsToDeadline != null
                      ? `per month for the next ${monthsToDeadline} ${monthsToDeadline === 1 ? "month" : "months"}`
                      : "set a deadline to size this"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Projected to hit</p>
                  <p className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
                    {isCompleted
                      ? "Done"
                      : isPaused
                      ? "—"
                      : projectedDate
                      ? projectedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
                      : "Need pace"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isCompleted
                      ? "Time to set the next one."
                      : isPaused
                      ? "Resume to start the clock again."
                      : projectedMonths != null
                      ? `at your current pace of $${Math.round(observedMonthlyPace).toLocaleString()}/mo`
                      : "save your first dollar to forecast"}
                  </p>
                </div>
              </div>
            </div>

            {/* Math grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              <StatCard
                icon={Calendar}
                label="Started"
                value={
                  startedDate
                    ? startedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Imported from setup"
                }
                hint={
                  daysSinceStart != null
                    ? daysSinceStart === 0
                      ? "Brand new — let's go!"
                      : `${daysSinceStart} day${daysSinceStart === 1 ? "" : "s"} in.`
                    : "Original creation date isn't tracked for this one."
                }
              />
              <StatCard
                icon={TrendingUp}
                label="Monthly pace"
                value={
                  observedMonthlyPace > 0
                    ? `$${Math.round(observedMonthlyPace).toLocaleString()}/mo`
                    : "Just getting started"
                }
                hint={
                  observedMonthlyPace > 0
                    ? paceConfidence === "reliable"
                      ? `Based on ${paceContribCount} contributions across ${paceSpanDays} days.`
                      : paceContribCount > 0
                      ? `Early signal from ${paceContribCount} contribution${paceContribCount === 1 ? "" : "s"} — pace will firm up as you log more.`
                      : `Early signal — based on $${saved.toLocaleString()} saved in ${daysSinceStart ?? 0} day${daysSinceStart === 1 ? "" : "s"}.`
                    : "Save your first dollar to set a pace."
                }
              />
              <StatCard
                icon={Calendar}
                label="Completion forecast"
                value={
                  isCompleted
                    ? "Already done!"
                    : isPaused
                    ? "Paused"
                    : projectedDate
                    ? projectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    : deadlineDate
                    ? deadlineDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    : "Need a deadline"
                }
                hint={
                  isCompleted
                    ? "Time to set the next one."
                    : isPaused
                    ? "Resume to start the clock again."
                    : projectedMonths != null
                    ? `On your current track, ~${projectedMonths} ${projectedMonths === 1 ? "month" : "months"} away.`
                    : deadlineDate
                    ? `If you hit the required ~$${Math.round(requiredMonthlyPace).toLocaleString()}/mo pace, you'll land it by your deadline.`
                    : "Set a deadline so I can pace this for you."
                }
              />
              <StatCard
                icon={Zap}
                label="Daily Safe-to-Spend bite"
                value={
                  isPaused
                    ? "$0 / day"
                    : !goal.is_enrolled
                    ? "Not enrolled"
                    : `$${stsBite.toFixed(2)} / day`
                }
                hint={
                  isPaused
                    ? "Savings are off — full daily limit available."
                    : !goal.is_enrolled
                    ? "Tracking only — toggle enrollment on the card to start carving from STS."
                    : `This goal reserves ~$${Math.round(requiredMonthlyPace).toLocaleString()}/mo from your daily limit.`
                }
                accent
              />
              <StatCard
                icon={Target}
                label="Still need to save"
                value={`$${remaining.toLocaleString()}`}
                hint={
                  monthsToDeadline != null
                    ? `${monthsToDeadline} ${monthsToDeadline === 1 ? "month" : "months"} until deadline.`
                    : "No deadline set yet."
                }
              />
            </div>

            {/* Milestone timeline */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Milestones
              </h3>
              <div className="relative pl-6">
                <span className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {MILESTONES.map((m) => {
                  const reached = progress >= m
                  return (
                    <div key={m} className="relative flex items-center gap-3 py-2.5">
                      <span
                        className={`absolute -left-6 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                          reached
                            ? "bg-aurora-emerald border-aurora-emerald shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                            : "bg-background border-border"
                        }`}
                      />
                      <p
                        className={`text-sm flex-1 ${
                          reached ? "text-foreground font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {m === 10 && "10% reached — first momentum"}
                        {m === 25 && "Quarter of the way there"}
                        {m === 50 && "Halfway! Big middle moment"}
                        {m === 75 && "Three-quarters home"}
                        {m === 100 && "Goal reached — claim your reward"}
                      </p>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ${Math.round((m / 100) * goal.amount).toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Log savings — inline contribution row */}
            {!isCompleted && (
              <div className="rounded-2xl border border-border bg-background/40 backdrop-blur-md p-4">
                {logOpen ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                        $
                      </span>
                      <input
                        type="number"
                        autoFocus
                        value={logInput}
                        onChange={(e) => setLogInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") logSavings()
                          if (e.key === "Escape") {
                            setLogOpen(false)
                            setLogInput("")
                          }
                        }}
                        placeholder="200"
                        inputMode="decimal"
                        className="w-full bg-muted/60 border border-border rounded-lg pl-7 pr-3 py-2 text-foreground placeholder:text-muted-foreground/70 text-sm focus:outline-none focus:border-aurora-teal/50 focus:ring-2 focus:ring-aurora-teal/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={logSavings}
                        disabled={busy === "log" || !logInput}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-aurora-emerald to-aurora-teal text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {busy === "log" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Log
                      </button>
                      <button
                        onClick={() => {
                          setLogOpen(false)
                          setLogInput("")
                        }}
                        className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground hover:bg-muted/60 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Log a contribution</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Add to your saved total. Updates pace, forecast, and progress instantly.
                      </p>
                    </div>
                    <button
                      onClick={() => setLogOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-aurora-emerald/15 border border-aurora-emerald/40 text-aurora-emerald text-sm font-medium hover:bg-aurora-emerald/25 transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Log savings
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Contribution history with Plaid verification badges */}
            {contributions.length > 0 && (
              <div className="rounded-2xl border border-border bg-background/40 backdrop-blur-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">Recent contributions</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Plaid-verified earns Karma
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {contributions.slice(0, 6).map((c) => {
                    const date = new Date(c.claimed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    const badge =
                      c.verification_status === "verified"
                        ? { label: "Plaid-verified", cls: "bg-aurora-emerald/15 border-aurora-emerald/40 text-aurora-emerald" }
                        : c.verification_status === "probable"
                        ? { label: "Probable", cls: "bg-aurora-teal/15 border-aurora-teal/40 text-aurora-teal" }
                        : c.verification_status === "pending"
                        ? { label: "Pending verification", cls: "bg-amber-500/15 border-amber-500/40 text-amber-300" }
                        : { label: "Unverified", cls: "bg-rose-500/15 border-rose-500/40 text-rose-300" }
                    return (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border/40"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-mono tabular-nums text-foreground shrink-0">
                            +${Number(c.amount).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{date}</span>
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/40">
              <button
                onClick={triggerEdit}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-border text-foreground/90 text-sm font-medium hover:bg-muted/60 transition-all disabled:opacity-50"
              >
                <Pencil className="w-4 h-4" />
                Edit goal
              </button>

              {!isCompleted && (
                <button
                  onClick={togglePause}
                  disabled={busy === "pause"}
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 ${
                    isPaused
                      ? "bg-aurora-emerald/15 text-aurora-emerald border border-aurora-emerald/40 hover:bg-aurora-emerald/25"
                      : "border border-border text-foreground/90 hover:bg-muted/60"
                  }`}
                >
                  {busy === "pause" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                  {isPaused ? "Resume savings" : "Pause savings"}
                </button>
              )}

              {isCompleted && (
                <button
                  onClick={() => {
                    confetti({
                      particleCount: 240,
                      spread: 110,
                      origin: { y: 0.6 },
                      colors: ["#34d399", "#2dd4bf", "#818cf8", "#fbbf24"],
                    })
                    onClaim?.()
                  }}
                  className="relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-500" />
                  <span className="relative text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Claim reward
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Paused glassmorphic overlay sticker */}
          {isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold backdrop-blur-md inline-flex items-center gap-1.5"
            >
              <Pause className="w-3 h-3" />
              Savings paused
            </motion.div>
          )}
         </div>
        </div>
      </motion.div>
    </>,
    document.body
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-md ${
        accent
          ? "border-aurora-teal/40 bg-aurora-teal/[0.06]"
          : "border-border bg-background/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ? "text-aurora-teal" : "text-muted-foreground"}`} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
      </div>
      <p
        className={`text-xl sm:text-2xl font-bold tabular-nums ${
          accent ? "text-aurora-teal" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground/80 mt-1">{hint}</p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Tab 3 — Categories
// ──────────────────────────────────────────────────────────────────────

function CategoriesTab({
  metrics,
  bankLinked,
  hasVaultData,
}: {
  metrics: Metrics | null
  bankLinked: boolean
  hasVaultData: boolean
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  // Hover state for our custom-positioned tooltip. We pin the floating
  // card above the chart so it never overlaps the centered STS number.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const isReady = bankLinked || hasVaultData

  const data = useMemo(() => {
    if (!metrics?.spendingByCategory) return [] as { key: string; value: number; meta: ReturnType<typeof categoryMeta> }[]
    return Object.entries(metrics.spendingByCategory)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, value]) => ({ key, value, meta: categoryMeta(key) }))
  }, [metrics])

  const total = data.reduce((s, d) => s + d.value, 0)
  const sts = metrics?.safeToSpend.dailySafeToSpend ?? 0

  // Per-category transactions. Consumes the server-side `transactionsByCategory`
  // map (built from the SAME `realSpending` set that feeds spendingByCategory),
  // so the expanded list always reconciles with the summary number. Falls
  // back to the legacy client-side bucket only if the server didn't ship
  // the new field.
  const txByCategory = useMemo(() => {
    if (metrics?.transactionsByCategory) return metrics.transactionsByCategory
    const map: Record<string, { name: string; amount: number; date: string }[]> = {}
    for (const t of metrics?.recentTransactions ?? []) {
      const k = t.category ?? "Other"
      if (!map[k]) map[k] = []
      if (t.amount > 0) map[k].push({ name: t.name, amount: t.amount, date: t.date })
    }
    return map
  }, [metrics])

  if (!isReady) {
    return (
      <div className="glass p-10 text-center">
        <PieIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Upload a bank statement to your Vault to see your spending breakdown.
          Live bank sync is coming after Plaid production approval.
        </p>
      </div>
    )
  }

  // Vault-only mode: bank isn't linked but we have an uploaded statement.
  // Label the source so the user knows the numbers reflect their PDF,
  // not a live feed.
  const vaultOnly = !bankLinked && hasVaultData

  return (
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
      {/* Donut + center STS */}
      <div className="glass p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <PieIcon className="w-4 h-4 text-aurora-teal" />
          <h3 className="text-sm font-semibold text-foreground">
            {vaultOnly ? "Statement breakdown" : "This month at a glance"}
          </h3>
          {vaultOnly && (
            <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-400/90 font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30">
              From uploaded statement
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {vaultOnly
            ? "Spending categories pulled from your most recent PDF upload."
            : "Spending breakdown with your daily limit at the center — your discipline pivot."}
        </p>
        <div className="relative w-full h-72">
          {/* Custom hover tooltip — pinned above the donut so it never
              overlaps the centered STS number. Fades in/out via CSS. */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 top-0 z-20 pointer-events-none transition-all duration-200 ${
              hoveredKey
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-1"
            }`}
          >
            {(() => {
              const slice = data.find((d) => d.key === hoveredKey)
              if (!slice) return null
              const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
              return (
                <div
                  className="rounded-lg border bg-[rgba(13,21,39,0.96)] backdrop-blur-md shadow-2xl px-3 py-2 min-w-[140px]"
                  style={{ borderColor: "rgba(255,255,255,0.12)" }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: slice.meta.color }}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                      {slice.meta.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-white tabular-nums">
                      ${slice.value.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-white/50 tabular-nums">{pct}%</span>
                  </div>
                </div>
              )
            })()}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.length > 0 ? data : [{ key: "empty", value: 1, meta: categoryMeta("OTHER") }]}
                dataKey="value"
                nameKey="key"
                innerRadius="65%"
                outerRadius="92%"
                strokeWidth={0}
                paddingAngle={data.length > 1 ? 2 : 0}
                animationBegin={0}
                animationDuration={900}
                onMouseEnter={(_, idx) => {
                  if (data.length === 0) return
                  setHoveredKey(data[idx]?.key ?? null)
                }}
                onMouseLeave={() => setHoveredKey(null)}
              >
                {(data.length > 0 ? data : [{ key: "empty", value: 1, meta: categoryMeta("OTHER") }]).map((d, i) => (
                  <Cell
                    key={i}
                    fill={data.length > 0 ? d.meta.color : "rgba(100,116,139,0.15)"}
                    fillOpacity={hoveredKey && hoveredKey !== d.key ? 0.45 : 1}
                    style={{ transition: "fill-opacity 180ms ease" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centered STS */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Daily Safe-to-Spend</p>
            <p
              className="text-4xl sm:text-5xl font-bold bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet bg-clip-text text-transparent leading-none mt-1 tabular-nums"
              style={{ textShadow: "0 0 30px rgba(20, 184, 166, 0.25)" }}
            >
              ${Math.round(sts)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              ${total.toFixed(0)} {vaultOnly ? "on your statement" : "spent so far"}
            </p>
          </div>
        </div>
      </div>

      {/* Category list with expandable transactions */}
      <div className="glass p-2">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground/80 text-center py-12">
            {vaultOnly
              ? "No discretionary spending found on your uploaded statement."
              : "No spending recorded this month yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {data.map(({ key, value, meta }) => {
              const isOpen = expanded === key
              const Icon = meta.icon
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              const txs = txByCategory[key] ?? []
              return (
                <li key={key}>
                  <button
                    onClick={() => setExpanded((cur) => (cur === key ? null : key))}
                    className="w-full text-left p-3 sm:p-4 rounded-lg hover:bg-muted/40 transition-colors flex items-center gap-3"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{meta.label}</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums">${value.toFixed(0)}</p>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: meta.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pl-14 pr-4 pb-3 space-y-2">
                          {txs.length === 0 ? (
                            <p className="text-xs text-muted-foreground/70 py-2">
                              No recent transactions in this category.
                            </p>
                          ) : (
                            txs.map((t, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-b-0"
                              >
                                <div className="min-w-0">
                                  <p className="text-foreground/90 truncate">{t.name}</p>
                                  <p className="text-muted-foreground/70 text-[10px]">
                                    {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </p>
                                </div>
                                <p className="text-foreground/90 font-mono tabular-nums shrink-0 ml-3">
                                  ${t.amount.toFixed(2)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
