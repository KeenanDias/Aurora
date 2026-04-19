"use client"

import { useState, useCallback, useEffect } from "react"
import { usePlaidLink } from "react-plaid-link"
import { ArrowRight, Check, Loader2 } from "lucide-react"

export function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "linked">("idle")

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

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setStatus("loading")
      const res = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      })

      if (res.ok) {
        setStatus("linked")
        onSuccess()
      } else {
        setStatus("idle")
      }
    },
    [onSuccess]
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
