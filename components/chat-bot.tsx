"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import { motion, AnimatePresence, useDragControls } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Send, X, Sparkles, GripHorizontal, Paperclip } from "lucide-react"
import { SecurityLoader } from "@/components/security-loader"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const NEW_USER_WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey! I'm Aurora — your personal financial coach.\n\nI'm here to help you figure out your **Safe-to-Spend**, set goals, and make sure money stress doesn't run your life.\n\nLet's start simple — what's your name?",
}

const DEFAULT_SIZE = { width: 400, height: 560 }
const MIN_SIZE = { width: 320, height: 400 }
const MAX_SIZE = { width: 700, height: 800 }

// Cross-component / cross-tab dashboard sync. Listeners live in DashboardMetrics.
type BroadcastPayload =
  | { type: "spending-updated" }
  | { type: "profile-updated" }
  | { type: "vault-updated" }
  | { type: "intent-progress"; intent: string }
  | { type: "intent-cancel"; intent: string }
  | { type: "goal-created"; goalId?: string }
  | { type: "goal-updated"; goalId?: string }

function broadcast(payload: BroadcastPayload) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
  try {
    const ch = new BroadcastChannel("aurora")
    ch.postMessage(payload)
    ch.close()
  } catch {
    // ignore — fallback handlers (window events / global refresh) still fire
  }
}

// ──────────────────────────────────────────────────────────────────────
// Scripted flows — bypass the LLM for fast, deterministic interactions
// triggered from the dashboard (e.g. the "Add Goal" card).
// ──────────────────────────────────────────────────────────────────────
type AddGoalState = {
  intent: "ADD_GOAL"
  step: "name" | "amount" | "deadline" | "saving"
  collected: { description?: string; amount?: number; deadline?: string }
}
type EditGoalState = {
  intent: "EDIT_GOAL"
  step: "field" | "amount" | "deadline" | "saving"
  goalId: string
  goalDescription: string
  field?: "amount" | "deadline"
  collected: { amount?: number; deadline?: string | null }
}
type ScriptedFlow = AddGoalState | EditGoalState | null

export function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [welcomeLoaded, setWelcomeLoaded] = useState(false)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [uploadStatus, setUploadStatus] = useState<"uploading" | "encrypting" | "secure" | null>(null)
  const [uploadFileName, setUploadFileName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [scriptedFlow, setScriptedFlow] = useState<ScriptedFlow>(null)
  const scriptedFlowRef = useRef<ScriptedFlow>(null)
  useEffect(() => {
    scriptedFlowRef.current = scriptedFlow
  }, [scriptedFlow])
  // Pending file for "Upload anyway" after a verification mismatch.
  const [pendingMismatch, setPendingMismatch] = useState<{
    file: File
    failures: string[]
  } | null>(null)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openRef = useRef(open)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const dragControls = useDragControls()

  useEffect(() => {
    openRef.current = open
  }, [open])

  // Fetch profile on mount
  useEffect(() => {
    async function loadWelcome() {
      try {
        const res = await fetch("/api/chat/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.onboarded && data.name) {
            setMessages([
              {
                id: "welcome",
                role: "assistant",
                content: `Hey ${data.name}! Welcome back.\n\nAnything I can help with today? I can give you an update on your **${data.goal_description || "savings goal"}**, check your **daily Safe-to-Spend**, or just chat about money stuff.`,
              },
            ])
          } else {
            setMessages([NEW_USER_WELCOME])
          }
        } else {
          setMessages([NEW_USER_WELCOME])
        }
      } catch {
        setMessages([NEW_USER_WELCOME])
      }
      setWelcomeLoaded(true)
    }
    loadWelcome()
  }, [])

  // Auto-scroll: find the Radix scroll viewport and scroll it to bottom
  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const viewport = el.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
      })
    }
  }, [messages, isLoading])

  // Reset window size and position every time it opens
  const [sessionKey, setSessionKey] = useState(0)
  useEffect(() => {
    if (open) {
      setSize(DEFAULT_SIZE)
      setSessionKey((k) => k + 1)
      setTimeout(() => inputRef.current?.focus(), 200)
      setUnreadCount(0)
    }
  }, [open])

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg])
    if (!openRef.current && msg.role === "assistant" && msg.id !== "welcome") {
      setUnreadCount((c) => c + 1)
    }
  }, [])

  // Push an Aurora message after a typing-dots beat.
  const pushAuroraTyped = useCallback(async (text: string, delay = 700) => {
    setIsLoading(true)
    await new Promise((r) => setTimeout(r, delay))
    setIsLoading(false)
    addMessage({ id: `s-${Date.now()}-${Math.random()}`, role: "assistant", content: text })
  }, [addMessage])

  // Kick off the ADD_GOAL scripted flow.
  const startAddGoalFlow = useCallback(async () => {
    // Drop the welcome bubble so the script feels like a fresh task.
    setMessages((prev) => prev.filter((m) => m.id !== "welcome"))
    setScriptedFlow({ intent: "ADD_GOAL", step: "name", collected: {} })
    setOpen(true)
    broadcast({ type: "intent-progress", intent: "ADD_GOAL" })
    await pushAuroraTyped(
      "Hey! Ready to set a new target? **What are we saving for?**\n\n*(e.g., A new PC, a flight to Tokyo, or an Emergency Fund.)*",
      400
    )
  }, [pushAuroraTyped])

  // Kick off the EDIT_GOAL scripted flow for an existing goal.
  const startEditGoalFlow = useCallback(
    async (goalId: string, goalDescription: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== "welcome"))
      setScriptedFlow({
        intent: "EDIT_GOAL",
        step: "field",
        goalId,
        goalDescription,
        collected: {},
      })
      setOpen(true)
      broadcast({ type: "intent-progress", intent: "EDIT_GOAL" })
      await pushAuroraTyped(
        `Let's tweak **${goalDescription}**. What do you want to change — the **amount** or the **deadline**?`,
        400
      )
    },
    [pushAuroraTyped]
  )

  // Listen for cross-component intent triggers (e.g. dashboard "Add Goal" card).
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel("aurora")
    const handler = (e: MessageEvent) => {
      const t = e.data?.type
      if (t === "trigger-intent" && e.data?.intent === "ADD_GOAL") {
        // Don't restart if already mid-flow.
        if (scriptedFlowRef.current?.intent === "ADD_GOAL") {
          setOpen(true)
          return
        }
        startAddGoalFlow()
      }
      if (t === "trigger-intent" && e.data?.intent === "EDIT_GOAL" && e.data?.goalId) {
        if (scriptedFlowRef.current?.intent === "EDIT_GOAL") {
          setOpen(true)
          return
        }
        startEditGoalFlow(String(e.data.goalId), String(e.data.goalDescription ?? "this goal"))
      }
      if (t === "intent-cancel" && (e.data?.intent === "ADD_GOAL" || e.data?.intent === "EDIT_GOAL")) {
        if (scriptedFlowRef.current?.intent === e.data.intent) {
          setScriptedFlow(null)
          pushAuroraTyped("All good — we'll skip that for now. Ping me when you're ready.", 300)
        }
      }
    }
    ch.addEventListener("message", handler)
    return () => {
      ch.removeEventListener("message", handler)
      ch.close()
    }
  }, [startAddGoalFlow, startEditGoalFlow, pushAuroraTyped])

  // Try to parse a date out of free text. Accepts ISO, "by Aug 2026",
  // "December 31", and "in N months/weeks".
  const parseDeadline = useCallback((raw: string): string | null => {
    const text = raw.trim().toLowerCase()
    const now = new Date()

    // "in N months" / "in N weeks" / "in N days"
    const rel = text.match(/in\s+(\d+)\s+(day|week|month|year)s?/)
    if (rel) {
      const n = parseInt(rel[1], 10)
      const unit = rel[2]
      const d = new Date(now)
      if (unit === "day") d.setDate(d.getDate() + n)
      if (unit === "week") d.setDate(d.getDate() + n * 7)
      if (unit === "month") d.setMonth(d.getMonth() + n)
      if (unit === "year") d.setFullYear(d.getFullYear() + n)
      return d.toISOString().slice(0, 10)
    }

    // Direct Date.parse fallback
    const parsed = new Date(raw)
    if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now() - 1000 * 60 * 60 * 24) {
      return parsed.toISOString().slice(0, 10)
    }
    return null
  }, [])

  // Handle one user reply within the ADD_GOAL flow. Returns true if handled.
  const handleScriptedAddGoal = useCallback(
    async (userText: string): Promise<boolean> => {
      const flow = scriptedFlowRef.current
      if (!flow || flow.intent !== "ADD_GOAL") return false

      if (flow.step === "name") {
        const description = userText.trim()
        if (description.length < 2) {
          await pushAuroraTyped("Just a few words about the goal — what should we call it?", 350)
          return true
        }
        setScriptedFlow({ ...flow, step: "amount", collected: { ...flow.collected, description } })
        await pushAuroraTyped(
          `Love it — **${description}**.\n\nHow much do we need? Just the number (e.g., \`5000\`).`,
          500
        )
        return true
      }

      if (flow.step === "amount") {
        const cleaned = userText.replace(/[^0-9.]/g, "")
        const amount = Number(cleaned)
        if (!Number.isFinite(amount) || amount <= 0) {
          await pushAuroraTyped("That doesn't look like a dollar amount. Try a number like `2500`.", 350)
          return true
        }
        if (amount > 10_000_000) {
          await pushAuroraTyped("Whoa — let's keep this under $10M. Try a smaller number?", 350)
          return true
        }
        setScriptedFlow({ ...flow, step: "deadline", collected: { ...flow.collected, amount } })
        await pushAuroraTyped(
          `Got it — **$${amount.toLocaleString()}**.\n\nWhen do you want to hit it by? You can say a date (\`Dec 2026\`) or a window (\`in 8 months\`). Or type **skip** if there's no deadline.`,
          500
        )
        return true
      }

      if (flow.step === "deadline") {
        let deadline: string | null = null
        const skip = /^(skip|none|no deadline|nope)/i.test(userText.trim())
        if (!skip) {
          deadline = parseDeadline(userText)
          if (!deadline) {
            await pushAuroraTyped(
              "I couldn't read that as a date. Try something like `Dec 2026`, `2027-01-15`, or `in 6 months`. Or `skip` to leave it open.",
              400
            )
            return true
          }
        }

        const collected = { ...flow.collected, deadline: deadline ?? undefined }
        setScriptedFlow({ ...flow, step: "saving", collected })
        await pushAuroraTyped("Saving it now…", 250)

        try {
          const res = await fetch("/api/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: collected.description,
              amount: collected.amount,
              deadline: collected.deadline ?? null,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Save failed")

          broadcast({ type: "goal-created", goalId: data.goal?.id })
          broadcast({ type: "profile-updated" })

          await pushAuroraTyped(
            `**Done!** Your new goal is lined up on the dashboard.${
              deadline
                ? ` We'll pace it to hit by ${new Date(deadline).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
                : ""
            } Want to add another, or jump back to coaching?`,
            550
          )
        } catch (err) {
          await pushAuroraTyped(
            `Hmm, I hit a snag saving that${err instanceof Error ? `: ${err.message}` : ""}. Want to try again?`,
            350
          )
          broadcast({ type: "intent-cancel", intent: "ADD_GOAL" })
        }
        setScriptedFlow(null)
        return true
      }

      return false
    },
    [parseDeadline, pushAuroraTyped]
  )

  // Handle EDIT_GOAL replies. Same pattern as ADD_GOAL but routes through
  // PATCH /api/goals/[id].
  const handleScriptedEditGoal = useCallback(
    async (userText: string): Promise<boolean> => {
      const flow = scriptedFlowRef.current
      if (!flow || flow.intent !== "EDIT_GOAL") return false

      const text = userText.trim()
      const tLower = text.toLowerCase()

      // Universal escape — bail out of the flow cleanly at any step.
      if (/^(cancel|nevermind|never mind|stop|exit|forget it|abort)$/i.test(tLower)) {
        setScriptedFlow(null)
        await pushAuroraTyped(
          "All good — leaving that one alone. Let me know if you want to come back to it.",
          300
        )
        return true
      }

      if (flow.step === "field") {
        const t = tLower
        let field: "amount" | "deadline" | null =
          /amount|money|dollar|much|cost|price/.test(t) ? "amount" :
          /deadline|date|when|time|by/.test(t) ? "deadline" : null

        // Smart fallbacks — if the user skipped the keyword and just typed
        // a number or a date directly, jump to the right branch with it.
        if (!field) {
          const looksLikeMoney = /^\$?\s?\d{1,3}(?:[,]\d{3})*(\.\d+)?$|^\$?\d+(?:\.\d+)?$/.test(text)
          const parsedAsDate = parseDeadline(text)
          if (looksLikeMoney) {
            field = "amount"
          } else if (parsedAsDate) {
            field = "deadline"
          }
        }

        if (!field) {
          await pushAuroraTyped(
            "I just need to know which to change — type **amount** or **deadline**.\n\n*(Or type **cancel** if you'd rather skip this.)*",
            350
          )
          return true
        }

        if (field === "amount") {
          // If the user already typed a number, validate + save immediately.
          if (/\d/.test(text)) {
            const cleaned = text.replace(/[^0-9.]/g, "")
            const amount = Number(cleaned)
            if (Number.isFinite(amount) && amount > 0 && amount <= 10_000_000) {
              setScriptedFlow({ ...flow, step: "saving", field, collected: { amount } })
              await pushAuroraTyped(`Updating to **$${amount.toLocaleString()}**…`, 250)
              await commitEditGoal(flow.goalId, { amount })
              return true
            }
          }
          setScriptedFlow({ ...flow, step: "amount", field })
          await pushAuroraTyped("Got it. What's the new target dollar amount?", 400)
        } else {
          // If the user already typed a date, advance immediately.
          const directDate = parseDeadline(text)
          if (directDate) {
            setScriptedFlow({ ...flow, step: "saving", field, collected: { deadline: directDate } })
            await pushAuroraTyped(
              `Updating deadline to **${new Date(directDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}**…`,
              250
            )
            await commitEditGoal(flow.goalId, { deadline: directDate })
            return true
          }
          setScriptedFlow({ ...flow, step: "deadline", field })
          await pushAuroraTyped(
            "Cool — when do you want to hit it by? A date (`Dec 2026`) or a window (`in 8 months`).",
            400
          )
        }
        return true
      }

      if (flow.step === "amount") {
        const cleaned = userText.replace(/[^0-9.]/g, "")
        const amount = Number(cleaned)
        if (!Number.isFinite(amount) || amount <= 0) {
          await pushAuroraTyped("That doesn't look like a dollar amount. Try a number like `7500`.", 350)
          return true
        }
        if (amount > 10_000_000) {
          await pushAuroraTyped("Whoa — let's keep this under $10M. Try a smaller number?", 350)
          return true
        }
        setScriptedFlow({ ...flow, step: "saving", collected: { amount } })
        await pushAuroraTyped("Updating…", 250)
        await commitEditGoal(flow.goalId, { amount })
        return true
      }

      if (flow.step === "deadline") {
        const deadline = parseDeadline(userText)
        if (!deadline) {
          await pushAuroraTyped(
            "I couldn't read that as a date. Try `Dec 2026`, `2027-01-15`, or `in 6 months`.",
            400
          )
          return true
        }
        setScriptedFlow({ ...flow, step: "saving", collected: { deadline } })
        await pushAuroraTyped("Updating…", 250)
        await commitEditGoal(flow.goalId, { deadline })
        return true
      }

      return false
    },
    // commitEditGoal is defined just below — set as a ref-like via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parseDeadline, pushAuroraTyped]
  )

  const commitEditGoal = useCallback(
    async (goalId: string, patch: { amount?: number; deadline?: string | null }) => {
      try {
        const res = await fetch(`/api/goals/${goalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Update failed")

        broadcast({ type: "goal-updated", goalId })
        broadcast({ type: "profile-updated" })

        await pushAuroraTyped(
          `**Done!** ${
            patch.amount != null
              ? `New target is **$${patch.amount.toLocaleString()}**.`
              : patch.deadline
              ? `New deadline is **${new Date(patch.deadline).toLocaleDateString("en-US", { month: "long", year: "numeric" })}**.`
              : "Goal updated."
          } Anything else?`,
          550
        )
      } catch (err) {
        await pushAuroraTyped(
          `Hmm, I hit a snag updating that${err instanceof Error ? `: ${err.message}` : ""}. Want to try again?`,
          350
        )
      }
      setScriptedFlow(null)
    },
    [pushAuroraTyped]
  )

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    }

    // If a scripted flow is active, intercept before hitting the LLM.
    if (scriptedFlowRef.current) {
      setMessages((prev) => [...prev, userMessage])
      setInput("")
      const intent = scriptedFlowRef.current.intent
      const handled =
        intent === "ADD_GOAL"
          ? await handleScriptedAddGoal(trimmed)
          : intent === "EDIT_GOAL"
          ? await handleScriptedEditGoal(trimmed)
          : false
      if (handled) return
    }

    const updatedMessages = [
      ...messages.filter((m) => m.id !== "welcome"),
      userMessage,
    ]
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to get response")

      if (data.profileUpdated) {
        window.dispatchEvent(new Event("aurora-profile-updated"))
        broadcast({ type: "profile-updated" })
      }
      if (data.spendingUpdated) {
        broadcast({ type: "spending-updated" })
      }

      // Legacy fallback for any listeners still on the window pointer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refresh = (window as any).__refreshDashboardMetrics
      if (typeof refresh === "function") refresh()

      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
      })
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = useCallback(async (file: File, force = false) => {
    if (file.type !== "application/pdf") {
      addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: "I can only process PDF bank statements right now. Please upload a PDF file!",
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: "That file is too large (max 10MB). Try a smaller statement or just the pages with transactions.",
      })
      return
    }

    setUploadFileName(file.name)
    setUploadStatus("uploading")

    // Show user message about the upload
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: `[Uploaded bank statement: ${file.name}]`,
      },
    ])

    try {
      // Phase 1: Upload
      const formData = new FormData()
      formData.append("file", file)
      if (force) formData.append("force", "true")

      // Transition to encrypting after a beat
      await new Promise((r) => setTimeout(r, 800))
      setUploadStatus("encrypting")

      const res = await fetch("/api/vault/upload", {
        method: "POST",
        body: formData,
      })

      // Give the encryption animation time to be seen (minimum 1.5s)
      await new Promise((r) => setTimeout(r, 1500))

      const data = await res.json().catch(() => ({}))

      // Verification mismatch — surface a confirm prompt instead of failing silently.
      if (res.status === 409 && data.mismatch) {
        setUploadStatus(null)
        setPendingMismatch({ file, failures: data.failures ?? [] })
        addMessage({
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Heads up — this statement doesn't seem to match your linked bank account:\n\n${(data.failures ?? [])
            .map((f: string) => `• ${f}`)
            .join("\n")}\n\nIf you uploaded the wrong file, just **cancel** below. If this is from a different account on purpose, hit **Upload anyway**.`,
        })
        return
      }

      // Duplicate statement → not an error, just a heads-up.
      if (res.status === 409 && data.duplicate && data.existing) {
        const e = data.existing
        const uploaded = new Date(e.uploadedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        setUploadStatus("secure")
        await new Promise((r) => setTimeout(r, 800))
        addMessage({
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Looks like you've already uploaded this one!\n\n**Statement period:** ${e.periodStart} to ${e.periodEnd}\n**Originally saved:** ${uploaded}\n**Filename in vault:** ${e.filename}\n\nIt's still encrypted and safe in your **Data Vault** — no need to upload it again. Want me to open the vault?`,
        })
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "Upload failed")
      }

      // Phase 3: Secure
      setUploadStatus("secure")
      await new Promise((r) => setTimeout(r, 1200))

      const { summary } = data
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I've safely processed your statement. Here's what I found:\n\n**Period:** ${summary.periodStart} to ${summary.periodEnd}\n**Income:** $${summary.totalIncome.toLocaleString()}\n**Spending:** $${summary.totalSpending.toLocaleString()}\n**Fixed Bills:** $${summary.fixedBills.toLocaleString()}\n**Transactions:** ${summary.transactionCount}\n\nYour Daily Safe-to-Spend is now updated! You can also view this statement anytime in your **Data Vault**.`,
      })

      // Notify dashboard vault + metrics
      window.dispatchEvent(new Event("aurora-vault-updated"))
      window.dispatchEvent(new Event("aurora-profile-updated"))
      broadcast({ type: "vault-updated" })
      broadcast({ type: "profile-updated" })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refresh = (window as any).__refreshDashboardMetrics
      if (typeof refresh === "function") refresh()
    } catch (err) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I had trouble processing that statement${err instanceof Error ? `: ${err.message}` : ""}. Could you try again or upload a different PDF?`,
      })
    } finally {
      setUploadStatus(null)
      setUploadFileName("")
    }
  }, [addMessage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  // Resize from bottom-left corner
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    }

    const handleResizeMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const dx = resizeRef.current.startX - ev.clientX // left = bigger
      const dy = ev.clientY - resizeRef.current.startY // down = bigger
      setSize({
        width: Math.min(MAX_SIZE.width, Math.max(MIN_SIZE.width, resizeRef.current.startW + dx)),
        height: Math.min(MAX_SIZE.height, Math.max(MIN_SIZE.height, resizeRef.current.startH + dy)),
      })
    }

    const handleResizeEnd = () => {
      resizeRef.current = null
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", handleResizeEnd)
    }

    window.addEventListener("pointermove", handleResizeMove)
    window.addEventListener("pointerup", handleResizeEnd)
  }

  // Double-click header to snap back
  const handleDoubleClick = () => {
    setSize(DEFAULT_SIZE)
  }

  return (
    <>
      {/* Trigger button */}
      <Button
        onClick={() => setOpen((o) => !o)}
        size="icon-lg"
        className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 shadow-xl shadow-teal-500/30 border-0 transition-all hover:scale-105"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <MessageSquare className="w-6 h-6 text-white" />
            {isLoading && unreadCount === 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-background" />
              </span>
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-500 border-2 border-background text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </Button>

      {/* Floating chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            key={sessionKey}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragConstraints={{
              top: -(window?.innerHeight ? window.innerHeight - 88 - size.height : 0),
              left: -(window?.innerWidth ? window.innerWidth - 24 - size.width + 60 : 0),
              right: 0,
              bottom: 40,
            }}
            dragElastic={0}
            style={{
              width: size.width,
              height: size.height,
              position: "fixed",
              bottom: 88,
              right: 24,
              zIndex: 50,
            }}
            className="flex flex-col rounded-2xl border border-border bg-background shadow-2xl shadow-black/40 overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Aurora gradient glow on top edge */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-500" />

            {/* Drag overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 rounded-2xl bg-background/90 backdrop-blur-sm border-2 border-dashed border-teal-500/50 flex flex-col items-center justify-center gap-3"
                >
                  <Paperclip className="w-8 h-8 text-teal-400" />
                  <p className="text-sm text-foreground/80 font-medium">Drop your bank statement here</p>
                  <p className="text-xs text-muted-foreground/70">PDF files only</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload security animation overlay */}
            <AnimatePresence>
              {uploadStatus && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 rounded-2xl bg-background/95 backdrop-blur-xl flex items-center justify-center"
                >
                  <SecurityLoader status={uploadStatus} fileName={uploadFileName} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Draggable header */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              onDoubleClick={handleDoubleClick}
              className="flex items-center justify-between p-3 px-4 border-b border-border/60 cursor-grab active:cursor-grabbing select-none shrink-0 bg-gradient-to-r from-card via-card to-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet rounded-xl flex items-center justify-center shadow-lg shadow-aurora-teal/25">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold leading-tight">Aurora AI</p>
                  <p className="text-[11px] text-muted-foreground">Your financial coach</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <GripHorizontal className="w-4 h-4 text-muted-foreground/50 mr-1" />
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
              <div className="p-4 space-y-5">
                {!welcomeLoaded ? (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/60 border border-border/60 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                        <AvatarFallback
                          className={
                            msg.role === "assistant"
                              ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold"
                              : "bg-muted text-foreground/80 text-xs font-medium"
                          }
                        >
                          {msg.role === "assistant" ? "A" : "U"}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className={`max-w-[85%] w-full rounded-2xl px-4 py-3 text-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-aurora-emerald/20 to-aurora-teal/20 border border-aurora-emerald/30 text-foreground"
                            : "bg-muted/60 border border-border/60 text-foreground"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="aurora-markdown">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-3 last:mb-0 leading-relaxed">
                                    {children}
                                  </p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-foreground">
                                    {children}
                                  </strong>
                                ),
                                ul: ({ children }) => (
                                  <ul className="mb-3 last:mb-0 space-y-1.5 ml-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="mb-3 last:mb-0 space-y-1.5 ml-1 list-decimal list-inside">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="leading-relaxed flex gap-2">
                                    <span className="text-teal-400 mt-0.5 shrink-0">•</span>
                                    <span>{children}</span>
                                  </li>
                                ),
                                em: ({ children }) => (
                                  <em className="text-teal-300/90 not-italic">{children}</em>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 text-white text-xs font-bold">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/60 border border-border/60 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-teal-400/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div />
              </div>
            </ScrollArea>

            {/* Mismatch confirm bar */}
            {pendingMismatch && (
              <div className="shrink-0 px-3 pt-2 pb-1 border-t border-border/60 bg-amber-500/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-foreground/80 truncate">
                    Upload <span className="font-medium">{pendingMismatch.file.name}</span> anyway?
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        const file = pendingMismatch.file
                        setPendingMismatch(null)
                        handleFileUpload(file, true)
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium hover:bg-amber-500/30 transition-all"
                    >
                      Upload anyway
                    </button>
                    <button
                      onClick={() => setPendingMismatch(null)}
                      className="px-2.5 py-1 rounded-md border border-border text-muted-foreground text-[11px] font-medium hover:bg-muted/60 hover:text-foreground transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="shrink-0 p-3 pt-2 border-t border-border/60">
              <input
                ref={fileInputRef}
                id="aurora-chat-file-input"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                  e.target.value = ""
                }}
              />
              <div className="flex gap-2">
                <label
                  htmlFor="aurora-chat-file-input"
                  aria-disabled={isLoading || !!uploadStatus}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg border border-border text-muted-foreground hover:text-teal-400 hover:border-teal-500/30 hover:bg-teal-500/[0.05] transition-all shrink-0 cursor-pointer ${
                    isLoading || !!uploadStatus ? "opacity-30 pointer-events-none" : ""
                  }`}
                  title="Upload bank statement (PDF)"
                >
                  <Paperclip className="w-4 h-4" />
                </label>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Aurora anything..."
                  disabled={isLoading}
                  className="flex-1 bg-muted/60 border-border text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-aurora-teal/30 focus-visible:border-aurora-teal/50"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                Aurora AI may make mistakes. Verify important financial decisions.
              </p>
            </div>

            {/* Resize handle — bottom-left corner */}
            <div
              onPointerDown={handleResizeStart}
              className="absolute bottom-0 left-0 w-5 h-5 cursor-nesw-resize z-10 group"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="absolute bottom-1 left-1 text-muted-foreground/50 group-hover:text-teal-400/60 transition-colors"
              >
                <line x1="0" y1="12" x2="12" y2="0" stroke="currentColor" strokeWidth="1.5" />
                <line x1="0" y1="12" x2="7" y2="5" stroke="currentColor" strokeWidth="1.5" />
                <line x1="0" y1="12" x2="3" y2="9" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
