"use client"

import { useState, useTransition, useEffect } from "react"
import { Check, X, RotateCcw, Plus, Loader2, Mail, Clock, UserPlus, CheckCircle2 } from "lucide-react"
import { approveRequest, denyRequest, resetRequest, manuallyAddRequest } from "./actions"
import type { AccessRequest } from "./page"

type Filter = "all" | "pending" | "approved" | "denied"

// Format an ISO timestamp in the viewer's local timezone with abbreviation.
// Example: "Apr 30, 2026, 2:14 PM EDT"
function formatLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d)
}

// Relative time: "2m ago", "3h ago", "5d ago"
function relativeTime(iso: string | null): string {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  return `${mo}mo ago`
}

export function AdminContent({ initialRequests }: { initialRequests: AccessRequest[] }) {
  const [filter, setFilter] = useState<Filter>("pending")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  // Detect viewer's timezone label once on mount (e.g. "America/Toronto" or "EDT")
  const [tzLabel, setTzLabel] = useState<string>("")
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const abbr = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value
      setTzLabel(abbr ? `${abbr} · ${tz}` : tz)
    } catch {
      setTzLabel("")
    }
  }, [])

  const counts = {
    all: initialRequests.length,
    pending: initialRequests.filter((r) => r.status === "pending").length,
    approved: initialRequests.filter((r) => r.status === "approved").length,
    denied: initialRequests.filter((r) => r.status === "denied").length,
  }

  const filtered = filter === "all" ? initialRequests : initialRequests.filter((r) => r.status === filter)

  const handleApprove = (id: string) => {
    setPendingId(id)
    setFeedback(null)
    startTransition(async () => {
      const res = await approveRequest(id)
      setPendingId(null)
      if (res.error) setFeedback({ ok: false, message: res.error })
      else if (!res.emailSent) setFeedback({ ok: true, message: `Approved — but email failed: ${res.emailError ?? "unknown"}` })
      else setFeedback({ ok: true, message: "Approved and email sent" })
    })
  }

  const handleDeny = (id: string) => {
    setPendingId(id)
    setFeedback(null)
    startTransition(async () => {
      const res = await denyRequest(id)
      setPendingId(null)
      if (res.error) setFeedback({ ok: false, message: res.error })
      else setFeedback({ ok: true, message: "Denied" })
    })
  }

  const handleReset = (id: string) => {
    setPendingId(id)
    setFeedback(null)
    startTransition(async () => {
      const res = await resetRequest(id)
      setPendingId(null)
      if (res.error) setFeedback({ ok: false, message: res.error })
      else setFeedback({ ok: true, message: "Reset to pending" })
    })
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    const res = await manuallyAddRequest(newName, newEmail)
    setAdding(false)
    if (res.error) {
      setFeedback({ ok: false, message: res.error })
    } else {
      setFeedback({ ok: true, message: "Added to waitlist" })
      setNewName("")
      setNewEmail("")
      setShowAdd(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters + Add */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(["pending", "approved", "denied", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-white/10 text-white border border-white/20"
                  : "text-white/50 hover:text-white/80 border border-transparent"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
              <span className="text-xs text-white/30 ml-1">{counts[f]}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          title="Pre-create a waitlist entry without the user filling out the form. Useful for adding people you've talked to directly. Still needs Approve to grant access."
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/60 text-sm font-medium hover:bg-white/[0.04] hover:text-white/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add manually
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col sm:flex-row gap-3">
          <input
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-emerald-400/50"
          />
          <input
            required
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-emerald-400/50"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Add
          </button>
        </form>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            feedback.ok
              ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200"
              : "border-red-500/30 bg-red-500/[0.06] text-red-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Timezone hint */}
      {tzLabel && (
        <p className="text-xs text-white/30">
          All times shown in your local timezone <span className="text-white/50">({tzLabel})</span>
        </p>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-white/30 text-sm">No requests in this filter.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((r) => (
              <div key={r.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-white truncate">{r.name}</p>
                    <StatusBadge status={r.status} />
                    {r.source === "manual" && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">manual</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 truncate">{r.email}</p>
                  <div className="text-xs text-white/30 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className="inline-flex items-center gap-1"
                      title={formatLocal(r.requested_at)}
                    >
                      <Clock className="w-3 h-3" />
                      Requested {relativeTime(r.requested_at)}
                      <span className="text-white/20">· {formatLocal(r.requested_at)}</span>
                    </span>
                    {r.decided_at && (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          r.status === "approved" ? "text-emerald-400/70" : "text-red-400/70"
                        }`}
                        title={formatLocal(r.decided_at)}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {r.status === "approved" ? "Approved" : "Denied"} {relativeTime(r.decided_at)}
                        <span className="opacity-60">· {formatLocal(r.decided_at)}</span>
                      </span>
                    )}
                    {r.notified_at && (
                      <span
                        className="inline-flex items-center gap-1 text-emerald-400/70"
                        title={formatLocal(r.notified_at)}
                      >
                        <Mail className="w-3 h-3" />
                        Emailed {relativeTime(r.notified_at)}
                        <span className="opacity-60">· {formatLocal(r.notified_at)}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={pendingId === r.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                      >
                        {pendingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDeny(r.id)}
                        disabled={pendingId === r.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Deny
                      </button>
                    </>
                  )}
                  {r.status !== "pending" && (
                    <button
                      onClick={() => handleReset(r.id)}
                      disabled={pendingId === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs font-medium hover:bg-white/[0.04] hover:text-white/70 transition-all disabled:opacity-50"
                    >
                      {pendingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: "pending" | "approved" | "denied" }) {
  const styles = {
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    denied: "bg-red-500/20 text-red-300 border-red-500/30",
  }
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles[status]}`}>
      {status}
    </span>
  )
}
