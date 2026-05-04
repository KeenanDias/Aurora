"use client"

import { useState } from "react"
import { Loader2, Check } from "lucide-react"

export function EarlyAccessForm({
  endpoint = "/api/access/request",
  source = "landing",
}: {
  endpoint?: string
  source?: string
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, source }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: data.message })
        setName("")
        setEmail("")
      } else {
        setResult({ ok: false, message: data.error ?? "Something went wrong." })
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5 flex items-center gap-3">
        <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
          <Check className="w-5 h-5 text-emerald-400" />
        </div>
        <p className="text-sm text-white/80">{result.message}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          maxLength={100}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-background/80 dark:bg-white/[0.04] border border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground text-sm shadow-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
        />
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-background/80 dark:bg-white/[0.04] border border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground text-sm shadow-sm focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-500 to-violet-500 text-white font-medium text-sm shadow-lg shadow-teal-500/25 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {submitting ? "Submitting..." : "Request Early Access"}
      </button>
      {result && !result.ok && (
        <p className="text-xs text-red-400">{result.message}</p>
      )}
    </form>
  )
}
