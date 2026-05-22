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

      // Parse body defensively — a 5xx from Next.js/Render may return HTML
      // (not JSON), and JSON.parse would throw and fall into the catch as
      // "Network error" even though the request succeeded. Read as text
      // first, try JSON, and fall back to a useful message either way.
      const text = await res.text()
      let data: { ok?: boolean; message?: string; error?: string } = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* non-JSON response */ }

      if (res.ok) {
        setResult({
          ok: true,
          message: data.message ?? "Thanks! We'll be in touch shortly.",
        })
        setName("")
        setEmail("")
      } else {
        // Surface the server-side reason so we don't mask config errors as
        // "Network error". Falls back to a manual contact prompt if the
        // backend can't take the request right now.
        setResult({
          ok: false,
          message:
            data.error ??
            `Sign ups are closed right now. Please create an account to access the beta or email us at diaskeenana@gmail.com for further assistance.`,
        })
      }
    } catch {
      // Real network failure (offline, DNS, CORS preflight). Same graceful
      // fallback — give them a path that doesn't require the API.
      setResult({
        ok: false,
        message:
          "Couldn't reach our server. Email diaskeenana@gmail.com with your name and we'll add you manually.",
      })
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
        <div className="rounded-xl border-2 border-amber-500/70 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/[0.08] shadow-lg shadow-amber-500/10 p-4 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-amber-500 dark:bg-amber-500/30 flex items-center justify-center shrink-0">
            <span className="text-white dark:text-amber-300 text-sm font-bold leading-none">!</span>
          </div>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed">
            {result.message}
          </p>
        </div>
      )}
    </form>
  )
}
