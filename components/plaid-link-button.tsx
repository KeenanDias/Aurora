"use client"

import { useState, useCallback, useEffect } from "react"
import { usePlaidLink } from "react-plaid-link"
import { ArrowRight, Check, Loader2, AlertTriangle } from "lucide-react"

export function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "linked">("idle")
  const [mismatch, setMismatch] = useState<{ failures: string[]; warnings: string[]; publicToken: string } | null>(null)

  // Fetch link token on mount
  useEffect(() => {
    async function getToken() {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setLinkToken(data.link_token)
      }
    }
    getToken()
  }, [])

  const exchangeToken = useCallback(
    async (publicToken: string, force?: boolean) => {
      setStatus("loading")
      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken, force }),
      })

      if (res.ok) {
        setStatus("linked")
        setMismatch(null)
        onSuccess()
      } else if (res.status === 409) {
        const data = await res.json()
        setMismatch({ failures: data.failures ?? [], warnings: data.warnings ?? [], publicToken })
        setStatus("idle")
      } else {
        setStatus("idle")
      }
    },
    [onSuccess]
  )

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      await exchangeToken(publicToken)
    },
    [exchangeToken]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
  })

  if (status === "linked") {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium text-sm"
      >
        <Check className="w-4 h-4" />
        Bank Connected
      </button>
    )
  }

  if (mismatch) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">
                This bank account doesn&apos;t seem to match your uploaded statement
              </p>
              {mismatch.failures.map((f, i) => (
                <p key={i} className="text-xs text-white/50">• {f}</p>
              ))}
              <p className="text-xs text-white/40">
                Is this a different account from the one on your statement?
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exchangeToken(mismatch.publicToken, true)}
            disabled={status === "loading"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-sm font-medium hover:bg-white/[0.1] transition-all disabled:opacity-50"
          >
            {status === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Yes, link anyway
          </button>
          <button
            onClick={() => setMismatch(null)}
            className="px-4 py-2 rounded-lg border border-white/10 text-white/40 text-sm font-medium hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || status === "loading"}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-teal-500/20 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 transition-all disabled:opacity-50"
    >
      {status === "loading" ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          Connect Your Bank
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  )
}
