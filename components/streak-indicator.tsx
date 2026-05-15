"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { Flame, Info } from "lucide-react"

type StreakData = {
  streak: number
  longest: number
  brokenToday: boolean
  todaySpent: number
  todayLimit: number
  source: "plaid" | "manual_only" | "none"
}

/**
 * Header-level Budget Streak indicator.
 *
 * Shows "N Day Budget Streak" with a Flame icon. When today's spending
 * has already exceeded today's STS, the flame dims and a "cooling down"
 * caption appears — signaling the streak is at risk but not yet broken.
 *
 * Listens to `BroadcastChannel('aurora')` for spending/profile updates
 * so the count refreshes when the chatbot logs spending or a goal
 * change shifts STS.
 */
export function StreakIndicator() {
  const [data, setData] = useState<StreakData | null>(null)

  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch("/api/streaks")
      if (res.ok) setData(await res.json())
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchStreak()
  }, [fetchStreak])

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel("aurora")
    const handler = (e: MessageEvent) => {
      const t = e.data?.type
      if (t === "spending-updated" || t === "profile-updated" || t === "vault-updated" || t === "goal-updated") {
        fetchStreak()
      }
    }
    ch.addEventListener("message", handler)
    return () => {
      ch.removeEventListener("message", handler)
      ch.close()
    }
  }, [fetchStreak])

  const streak = data?.streak ?? 0
  const longest = data?.longest ?? 0
  const cooling = !!data?.brokenToday
  const todaySpent = data?.todaySpent ?? 0
  const todayLimit = data?.todayLimit ?? 0

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-background/60 backdrop-blur-md px-4 py-2.5">
      <div className="relative">
        <motion.div
          animate={
            cooling
              ? { scale: 1, opacity: 0.4 }
              : streak > 0
              ? { scale: [1, 1.08, 1], opacity: 1 }
              : { scale: 1, opacity: 0.5 }
          }
          transition={
            cooling
              ? { duration: 0.3 }
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          }
          className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${
            cooling
              ? "bg-muted border border-border"
              : streak > 0
              ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/40"
              : "bg-muted border border-border"
          }`}
        >
          <Flame className={`w-5 h-5 ${cooling || streak === 0 ? "text-muted-foreground" : "text-white"}`} />
        </motion.div>
        {!cooling && streak > 0 && (
          <span className="absolute -inset-0.5 rounded-xl ring-1 ring-orange-400/30 animate-pulse pointer-events-none" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-base font-bold text-foreground tabular-nums leading-none">{streak}</p>
          <p className="text-xs text-muted-foreground leading-none">
            Day Budget Streak
          </p>
        </div>
        <p className={`text-[10px] mt-1 leading-tight ${cooling ? "text-amber-400" : "text-muted-foreground/80"}`}>
          {cooling
            ? `Cooling down — $${todaySpent.toFixed(0)} of $${todayLimit.toFixed(0)} today`
            : longest > streak
            ? `Best ever: ${longest}`
            : streak > 0
            ? "Keep it hot 🔥"
            : "Stay under today to start your streak"}
        </p>
      </div>

      <PortalTooltip
        text={
          streak > 0
            ? `You've stayed under your daily limit for ${streak} day${streak === 1 ? "" : "s"} in a row. Keep it up to protect your goals!`
            : "Stay under your Daily Safe-to-Spend to start a streak. Each day under the limit counts."
        }
      />
    </div>
  )
}

/**
 * Hover-trigger tooltip rendered via React portal to document.body — so
 * its z-index isn't trapped by parent stacking contexts (the dashboard's
 * tab transition wraps content in a motion.div with filter:blur, which
 * creates a new context that beats normal z-index).
 */
function PortalTooltip({ text }: { text: string }) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      // Anchor under the icon, right-aligned to it.
      top: r.bottom + 8,
      left: r.right,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScrollOrResize = () => updatePosition()
    window.addEventListener("scroll", onScrollOrResize, true)
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [open, updatePosition])

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        className="ml-1 shrink-0 inline-flex items-center justify-center cursor-help outline-none"
      >
        <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
      </span>
      {mounted && open && pos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateX(-100%)", // align right edge to trigger's right edge
              zIndex: 9999,
            }}
            className="w-64 px-3 py-2.5 rounded-lg bg-popover border border-border shadow-2xl text-[11px] text-foreground/90 leading-relaxed pointer-events-none"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}
