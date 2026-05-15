"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowLeft, Send, Sparkles, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatBubble, ChatTypingDots } from "@/components/chat-bubble"

// ──────────────────────────────────────────────────────────────────────
// Script
// ──────────────────────────────────────────────────────────────────────

type InputType = "text" | "number" | "currency" | "choice" | "date" | "phone"

type Choice = { value: string; label: string }

type Step = {
  id: string
  prompt: string
  inputType: InputType
  placeholder?: string
  choices?: Choice[]
  validate?: (v: unknown) => string | null
  followUp?: (answer: unknown, all: Record<string, unknown>) => string
  // Return next step id, or "next" to continue, or null to continue.
  // To skip the current step, return the id you want to jump to.
  skipIf?: (all: Record<string, unknown>) => boolean
  optional?: boolean
}

const SCRIPT: Step[] = [
  {
    id: "name",
    prompt:
      "Hey! I'm **Aurora** — your financial coach. Let's get to know each other.\n\nWhat should I call you?",
    inputType: "text",
    placeholder: "Your first name",
    validate: (v) => (typeof v === "string" && v.trim().length >= 1 ? null : "Just a name will do."),
    followUp: (v) => `Nice to meet you, ${String(v).split(" ")[0]}!`,
  },
  {
    id: "age",
    prompt: "How old are you?",
    inputType: "number",
    placeholder: "e.g. 24",
    validate: (v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 13 || n > 120) return "Hmm, that doesn't look like an age — try a number between 13 and 120?"
      return null
    },
    followUp: () => "Got it.",
  },
  {
    id: "job",
    prompt: "And what do you do for work? Just a few words is fine.",
    inputType: "text",
    placeholder: "e.g. barista, dev, freelance designer",
    validate: (v) => (typeof v === "string" && v.trim().length >= 2 ? null : "A word or two works — what do you do?"),
    followUp: (v) => `Cool — ${String(v).toLowerCase()}.`,
  },
  {
    id: "income_type",
    prompt: "How do you earn it?",
    inputType: "choice",
    choices: [
      { value: "salary", label: "Salary" },
      { value: "hourly", label: "Hourly" },
      { value: "gig", label: "Gig" },
      { value: "irregular", label: "Irregular" },
      { value: "other", label: "Other" },
    ],
    followUp: (v) =>
      v === "gig" || v === "irregular"
        ? "Variable income — I'll keep that in mind. We'll plan around your slow weeks too."
        : "Got it.",
  },
  {
    id: "annual_income",
    prompt: "Roughly what do you make a year? Ballpark is fine — no judgment.",
    inputType: "currency",
    placeholder: "e.g. 55000",
    validate: (v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0) return "A rough number works — even $1?"
      if (n > 10_000_000) return "That's a lot — try a smaller number?"
      return null
    },
    followUp: (v) => `Got it — about $${Number(v).toLocaleString()} a year.`,
  },
  {
    id: "monthly_take_home",
    prompt: "And what actually hits your account each month, after taxes and deductions?",
    inputType: "currency",
    placeholder: "e.g. 3500",
    validate: (v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0) return "Just a ballpark dollar amount."
      if (n > 1_000_000) return "That looks too high for a monthly take-home — try again?"
      return null
    },
    followUp: (v) => `Solid — $${Number(v).toLocaleString()}/mo to work with.`,
  },
  {
    id: "living_situation",
    prompt: "What's your current living situation?",
    inputType: "choice",
    choices: [
      { value: "single", label: "Single" },
      { value: "couple", label: "Couple" },
      { value: "living_alone", label: "Living alone" },
      { value: "other", label: "Other" },
    ],
    followUp: () => "Got it.",
  },
  {
    id: "housing_status",
    prompt: "Do you rent, own, or neither?",
    inputType: "choice",
    choices: [
      { value: "rent", label: "Rent" },
      { value: "own", label: "Own" },
      { value: "other", label: "Neither" },
    ],
    followUp: () => "Noted.",
  },
  {
    id: "household_type",
    prompt: "Is this Safe-to-Spend just for you, or shared with someone?",
    inputType: "choice",
    choices: [
      { value: "individual", label: "Just me" },
      { value: "shared", label: "Shared" },
    ],
    skipIf: (all) => all.living_situation === "single",
    followUp: () => "Got it.",
  },
  {
    id: "goal_description",
    prompt:
      "Let's talk goals.\n\nWhat's a financial goal you'd love to hit? (saving for something, paying off debt, just breathing room — anything goes)",
    inputType: "text",
    placeholder: "e.g. save $5K for a trip, pay off credit card",
    validate: (v) => (typeof v === "string" && v.trim().length >= 3 ? null : "A short description works — what's the goal?"),
    followUp: (v) => `Love it — "${String(v).trim()}".`,
  },
  {
    id: "goal_amount",
    prompt: "How much would that goal cost in total?",
    inputType: "currency",
    placeholder: "e.g. 5000",
    validate: (v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0) return "A dollar amount, even rough?"
      return null
    },
    followUp: (v) => `Got it — $${Number(v).toLocaleString()}.`,
  },
  {
    id: "goal_deadline",
    prompt: "When would you want to hit that by?",
    inputType: "date",
    validate: (v) => {
      if (typeof v !== "string" || !v) return "Pick a date."
      const d = new Date(v)
      if (isNaN(d.getTime())) return "That date doesn't look right."
      if (d.getTime() < Date.now()) return "That's in the past — pick a future date?"
      return null
    },
    followUp: (v) => {
      const d = new Date(String(v))
      return `Locked in for ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`
    },
  },
  {
    id: "safety_buffer",
    prompt:
      "How much of a cushion do you want untouchable for emergencies?\n\n*$0 if you'd rather skip — you can set one later.*",
    inputType: "currency",
    placeholder: "e.g. 200",
    validate: (v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0) return "Zero or higher works."
      return null
    },
    followUp: (v) =>
      Number(v) > 0
        ? `Got it — $${Number(v).toLocaleString()} stays off-limits.`
        : "All good — no buffer for now.",
  },
  {
    id: "buffer_type",
    prompt: "Should that buffer come out monthly, or as a daily set-aside?",
    inputType: "choice",
    choices: [
      { value: "flat_monthly", label: "Monthly" },
      { value: "daily", label: "Daily" },
    ],
    skipIf: (all) => Number(all.safety_buffer ?? 0) === 0,
    followUp: () => "Got it.",
  },
  {
    id: "tax_withholding",
    prompt:
      "Should I hide ~25% of your income for taxes?\n\n*Recommended if you're gig/freelance and pay your own.*",
    inputType: "choice",
    choices: [
      { value: "yes", label: "Yes, hide 25%" },
      { value: "no", label: "No, I've got it" },
    ],
    skipIf: (all) => all.income_type === "salary",
    followUp: (v) =>
      v === "yes"
        ? "Smart — I'll keep 25% out of your daily limit."
        : "Got it — full income in play.",
  },
  {
    id: "money_habits",
    prompt: "Last big one — how would you describe your money habits?",
    inputType: "choice",
    choices: [
      { value: "spender", label: "Spender" },
      { value: "saver", label: "Saver" },
      { value: "between", label: "Somewhere between" },
      { value: "no_idea", label: "Honestly, no idea" },
    ],
    followUp: () => "Helpful to know — I'll calibrate around that.",
  },
  {
    id: "phone_number",
    prompt:
      "Want a daily SMS nudge with your Safe-to-Spend?\n\nDrop your number — or hit Skip if you'd rather just check the dashboard.",
    inputType: "phone",
    placeholder: "+1 416 555 1234",
    optional: true,
    validate: (v) => {
      if (!v) return null
      const digits = String(v).replace(/\D/g, "")
      if (digits.length < 10) return "That looks short for a phone number."
      return null
    },
    followUp: (v) => (v ? "Got it — I'll text you each morning." : "All good — dashboard it is."),
  },
]

// ──────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const STORAGE_KEY_PREFIX = "aurora-onboarding-v1"

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 0) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits}`
}

function transformAnswer(stepId: string, raw: unknown): unknown {
  if (raw == null) return null
  switch (stepId) {
    case "age":
    case "annual_income":
    case "monthly_take_home":
    case "goal_amount":
    case "safety_buffer":
      return Number(raw)
    case "tax_withholding":
      return raw === "yes"
    case "phone_number":
      return typeof raw === "string" && raw.trim() ? normalizePhone(raw) : null
    default:
      return typeof raw === "string" ? raw.trim() : raw
  }
}

export function OnboardingChat({ userId }: { userId: string }) {
  const router = useRouter()
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}`

  // Hydrate from localStorage so a refresh resumes from the last step.
  const initial = useMemo(() => {
    if (typeof window === "undefined") return { stepIndex: 0, answers: {} as Record<string, unknown> }
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return { stepIndex: 0, answers: {} }
      const parsed = JSON.parse(raw) as { stepIndex: number; answers: Record<string, unknown> }
      return {
        stepIndex: Math.max(0, Math.min(parsed.stepIndex ?? 0, SCRIPT.length - 1)),
        answers: parsed.answers ?? {},
      }
    } catch {
      return { stepIndex: 0, answers: {} }
    }
  }, [storageKey])

  const [messages, setMessages] = useState<Message[]>([])
  const [stepIndex, setStepIndex] = useState(initial.stepIndex)
  const [answers, setAnswers] = useState<Record<string, unknown>>(initial.answers)
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [exiting, setExiting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initBootstrapped = useRef(false)

  const currentStep = SCRIPT[stepIndex]
  const completed = Object.keys(answers).length

  // Persist on every change.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ stepIndex, answers }))
    } catch {
      // ignore quota errors
    }
  }, [stepIndex, answers, storageKey])

  // Auto-scroll to bottom on new messages or typing changes.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const viewport = root.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null
    if (viewport) {
      requestAnimationFrame(() => viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" }))
    }
  }, [messages, typing])

  // Focus input when text-style step becomes active.
  useEffect(() => {
    if (typing || submitting) return
    if (!currentStep) return
    if (currentStep.inputType === "choice") return
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [stepIndex, typing, submitting, currentStep])

  // ── Helpers ──────────────────────────────────────────────────────────
  const resolveNextIndex = useCallback(
    (fromIndex: number, ans: Record<string, unknown>) => {
      let idx = fromIndex + 1
      while (idx < SCRIPT.length && SCRIPT[idx].skipIf?.(ans)) idx++
      return idx
    },
    []
  )

  const pushAssistant = useCallback(async (text: string, delay = 700) => {
    setTyping(true)
    await new Promise((r) => setTimeout(r, delay + Math.random() * 200))
    setTyping(false)
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}-${Math.random()}`, role: "assistant", content: text },
    ])
  }, [])

  const askStep = useCallback(
    async (step: Step) => {
      await pushAssistant(step.prompt, 750)
    },
    [pushAssistant]
  )

  // Bootstrap: on mount, replay history that's already been answered, then
  // ask the current question. Runs exactly once.
  useEffect(() => {
    if (initBootstrapped.current) return
    initBootstrapped.current = true

    const replay: Message[] = []
    for (let i = 0; i < stepIndex; i++) {
      const s = SCRIPT[i]
      if (s.skipIf?.(answers)) continue
      const ans = answers[s.id]
      if (ans == null && !s.optional) continue
      replay.push({ id: `r-q-${i}`, role: "assistant", content: s.prompt })
      replay.push({
        id: `r-a-${i}`,
        role: "user",
        content: formatAnswerForDisplay(s, ans),
      })
      const reflection = s.followUp?.(ans, answers)
      if (reflection) replay.push({ id: `r-f-${i}`, role: "assistant", content: reflection })
    }
    setMessages(replay)

    // Then ask the current step (or finalize if we're past the end).
    const proceed = async () => {
      if (stepIndex >= SCRIPT.length) {
        finalize(answers)
        return
      }
      const step = SCRIPT[stepIndex]
      if (step.skipIf?.(answers)) {
        const next = resolveNextIndex(stepIndex - 1, answers)
        setStepIndex(next)
        return
      }
      // Tiny initial delay so the Aurora intro feels "alive."
      await new Promise((r) => setTimeout(r, 300))
      await askStep(step)
    }
    proceed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnswer = useCallback(
    async (rawAnswer: unknown) => {
      if (!currentStep || typing || submitting) return
      const transformed = transformAnswer(currentStep.id, rawAnswer)

      // Validate (unless optional + empty).
      const isEmpty = transformed == null || transformed === ""
      if (currentStep.validate && !(currentStep.optional && isEmpty)) {
        const err = currentStep.validate(transformed)
        if (err) {
          setError(null)
          // Surface validation as an Aurora correction message.
          setMessages((prev) => [
            ...prev,
            {
              id: `u-${Date.now()}`,
              role: "user",
              content: formatAnswerForDisplay(currentStep, rawAnswer),
            },
          ])
          await pushAssistant(err, 500)
          await pushAssistant(currentStep.prompt, 600)
          return
        }
      }

      // Push user message.
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: formatAnswerForDisplay(currentStep, rawAnswer),
        },
      ])

      const nextAnswers = { ...answers, [currentStep.id]: transformed }
      setAnswers(nextAnswers)
      setInput("")

      // Reflection.
      const reflection = currentStep.followUp?.(transformed, nextAnswers)
      if (reflection) await pushAssistant(reflection, 550)

      const next = resolveNextIndex(stepIndex, nextAnswers)
      if (next >= SCRIPT.length) {
        finalize(nextAnswers)
        return
      }
      setStepIndex(next)
      await askStep(SCRIPT[next])
    },
    [answers, askStep, currentStep, pushAssistant, resolveNextIndex, stepIndex, submitting, typing]
  )

  const handleBack = useCallback(() => {
    if (stepIndex === 0 || typing || submitting) return
    let prev = stepIndex - 1
    while (prev >= 0 && SCRIPT[prev].skipIf?.(answers)) prev--
    if (prev < 0) return

    // Strip the most-recent question + answer pair from the message list.
    const prevId = SCRIPT[prev].id
    const nextAnswers = { ...answers }
    delete nextAnswers[prevId]
    setAnswers(nextAnswers)

    // Rebuild messages from scratch up to (but not including) prev.
    const replay: Message[] = []
    for (let i = 0; i < prev; i++) {
      const s = SCRIPT[i]
      if (s.skipIf?.(nextAnswers)) continue
      const ans = nextAnswers[s.id]
      replay.push({ id: `r-q-${i}`, role: "assistant", content: s.prompt })
      replay.push({ id: `r-a-${i}`, role: "user", content: formatAnswerForDisplay(s, ans) })
      const reflection = s.followUp?.(ans, nextAnswers)
      if (reflection) replay.push({ id: `r-f-${i}`, role: "assistant", content: reflection })
    }
    // And ask the previous question.
    replay.push({ id: `r-q-${prev}`, role: "assistant", content: SCRIPT[prev].prompt })
    setMessages(replay)
    setStepIndex(prev)
    setError(null)
  }, [answers, stepIndex, submitting, typing])

  const finalize = useCallback(
    async (finalAnswers: Record<string, unknown>) => {
      setSubmitting(true)
      await pushAssistant(
        "Perfect — I've got everything I need. Setting up your dashboard now…",
        700
      )
      try {
        const res = await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalAnswers),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Save failed")
        }
        // Clear local progress.
        try {
          window.localStorage.removeItem(storageKey)
        } catch {
          // ignore
        }
        // Fade out, then push.
        setExiting(true)
        await new Promise((r) => setTimeout(r, 700))
        router.push("/dashboard")
      } catch (err) {
        setSubmitting(false)
        await pushAssistant(
          `Hmm, I hit a snag saving everything${err instanceof Error ? `: ${err.message}` : ""}. Want to try again?`,
          400
        )
      }
    },
    [pushAssistant, router, storageKey]
  )

  // ── Render input ─────────────────────────────────────────────────────
  const renderInput = () => {
    if (!currentStep || submitting) return null

    if (currentStep.inputType === "choice" && currentStep.choices) {
      return (
        <div className="flex flex-wrap gap-2 px-1">
          {currentStep.choices.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={typing}
              onClick={() => handleAnswer(c.value)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-muted/60 border border-border hover:border-aurora-teal/40 hover:bg-aurora-teal/[0.06] hover:text-foreground transition-all text-foreground/80 disabled:opacity-40 disabled:pointer-events-none"
            >
              {c.label}
            </button>
          ))}
        </div>
      )
    }

    const isCurrency = currentStep.inputType === "currency"
    const htmlInputType =
      currentStep.inputType === "number" || currentStep.inputType === "currency"
        ? "number"
        : currentStep.inputType === "date"
        ? "date"
        : currentStep.inputType === "phone"
        ? "tel"
        : "text"

    const submit = () => {
      if (!input && !currentStep.optional) return
      handleAnswer(input)
    }

    return (
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 relative">
          {isCurrency && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
          )}
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={currentStep.placeholder}
            type={htmlInputType}
            inputMode={isCurrency ? "decimal" : undefined}
            disabled={typing}
            className={`bg-muted/60 border-border text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-aurora-teal/30 focus-visible:border-aurora-teal/50 ${
              isCurrency ? "pl-7" : ""
            }`}
          />
        </div>
        {currentStep.optional && (
          <Button
            type="button"
            variant="outline"
            disabled={typing}
            onClick={() => handleAnswer("")}
            className="gap-1.5"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </Button>
        )}
        <Button
          size="icon"
          onClick={submit}
          disabled={typing || (!input && !currentStep.optional)}
          className="bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border-0 text-white disabled:opacity-30"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 120, mass: 0.6 }}
          className="relative z-10 min-h-screen flex flex-col"
        >
          {/* Header */}
          <header className="shrink-0 border-b border-border/40 bg-background/60 backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-violet-500" />
            <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet rounded-xl flex items-center justify-center shadow-lg shadow-aurora-teal/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground text-sm font-semibold leading-tight">Aurora</p>
                <p className="text-[11px] text-muted-foreground">Let&apos;s get you set up</p>
              </div>
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {SCRIPT.map((s, i) => {
                  const visible = !s.skipIf?.(answers)
                  if (!visible) return null
                  const done = i < stepIndex
                  return (
                    <span
                      key={s.id}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        done
                          ? "bg-aurora-teal"
                          : i === stepIndex
                          ? "bg-aurora-emerald scale-125"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          </header>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 overflow-hidden">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <ChatBubble role={m.role} content={m.content} />
                  </motion.div>
                ))}
                {typing && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <ChatTypingDots />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Footer / input bar */}
          <footer className="shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-xl">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 space-y-2">
              {error && <p className="text-xs text-red-400">{error}</p>}
              {renderInput()}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={stepIndex === 0 || typing || submitting}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </button>
                <p className="text-[10px] text-muted-foreground/60">
                  {completed} of {SCRIPT.filter((s) => !s.skipIf?.(answers)).length} answered
                </p>
              </div>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Display helpers
// ──────────────────────────────────────────────────────────────────────

function formatAnswerForDisplay(step: Step, raw: unknown): string {
  if (raw == null || raw === "") return step.optional ? "(skipped)" : ""
  if (step.inputType === "choice" && step.choices) {
    return step.choices.find((c) => c.value === raw)?.label ?? String(raw)
  }
  if (step.inputType === "currency") {
    return `$${Number(raw).toLocaleString()}`
  }
  if (step.inputType === "date" && typeof raw === "string") {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    }
  }
  return String(raw)
}
