"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { completeOnboarding } from "./actions"
import type { OnboardingData } from "./actions"
import { ArrowRight, ArrowLeft, Sparkles, User, Briefcase, DollarSign, Home, Target, Brain, HelpCircle, Flame } from "lucide-react"

const TOTAL_STEPS = 6

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showGoalHelp, setShowGoalHelp] = useState(false)
  const [complete, setComplete] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const [data, setData] = useState<OnboardingData>({
    full_name: "",
    age: 0,
    annual_income: 0,
    income_type: "",
    monthly_take_home: 0,
    living_situation: "",
    housing_status: "",
    financial_goals: "",
    money_habits: "",
  })

  // Auto-focus input on step change
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [step, showGoalHelp])

  const set = (field: keyof OnboardingData, value: string | number) => {
    setData((d) => ({ ...d, [field]: value }))
  }

  const progress = Math.round(((step + 1) / TOTAL_STEPS) * 100)

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return data.full_name.trim().length > 0 && data.age > 0
      case 1: return data.annual_income > 0 && data.income_type !== ""
      case 2: return data.monthly_take_home > 0
      case 3: return data.living_situation !== "" && data.housing_status !== ""
      case 4: return data.financial_goals.trim().length > 0
      case 5: return data.money_habits.trim().length > 0
      default: return false
    }
  }

  const handleNext = () => {
    if (!canProceed()) return
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
      setShowGoalHelp(false)
    } else {
      handleSubmit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleNext()
    }
  }

  const handleSubmit = async () => {
    setError("")
    setLoading(true)
    const result = await completeOnboarding(data)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setComplete(true)
    // Brief pause to show the completion screen, then redirect
    setTimeout(() => {
      // Trigger profile refresh on dashboard
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aurora-profile-updated"))
      }
      router.push("/dashboard")
    }, 2500)
  }

  // Option button helper
  const OptionBtn = ({
    label,
    selected,
    onClick,
  }: {
    label: string
    selected: boolean
    onClick: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
        selected
          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300"
          : "bg-white/[0.03] border border-white/[0.08] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
      }`}
    >
      {label}
    </button>
  )

  // ── Completion Screen ──────────────────────────────────────────────
  if (complete) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-transparent rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-transparent rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 text-center max-w-md px-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">You&apos;re all set!</h1>
          <p className="text-white/50 mb-4">
            Onboarding complete. You&apos;ve earned your first{" "}
            <span className="text-amber-300 font-semibold">50 Financial Karma</span> points.
          </p>
          <p className="text-white/30 text-sm">
            Link your bank next to start your streak and unlock more rewards.
          </p>
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] text-white/30 text-sm">
              <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
              Taking you to your dashboard...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step Content ───────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      // Step 1: Identity
      case 0:
        return (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-medium">Hello! I&apos;m Aurora.</p>
                <p className="text-white/50 text-sm mt-1">
                  I&apos;m here to help you get a handle on your money. To start, what is your name? And how old are you currently?
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                placeholder="Your full name"
                value={data.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
              />
              <input
                type="number"
                placeholder="Your age"
                value={data.age || ""}
                onChange={(e) => set("age", parseInt(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                min="13"
                max="120"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
              />
            </div>
          </div>
        )

      // Step 2: The Hustle
      case 1:
        return (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Briefcase className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-medium">
                  Nice to meet you{data.full_name ? `, ${data.full_name.split(" ")[0]}` : ""}!
                </p>
                <p className="text-white/50 text-sm mt-1">
                  What is your annual income? No judgment here, it just gives me a sense of your baseline.
                </p>
              </div>
            </div>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              placeholder="Annual income (e.g. 55000)"
              value={data.annual_income || ""}
              onChange={(e) => set("annual_income", parseFloat(e.target.value) || 0)}
              onKeyDown={handleKeyDown}
              min="0"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
            />
            <div>
              <p className="text-xs text-white/30 mb-2">How do you earn it?</p>
              <div className="flex flex-wrap gap-2">
                {["Salary", "Hourly", "Gig", "Irregular", "Other"].map((type) => (
                  <OptionBtn
                    key={type}
                    label={type}
                    selected={data.income_type === type.toLowerCase()}
                    onClick={() => set("income_type", type.toLowerCase())}
                  />
                ))}
              </div>
            </div>
          </div>
        )

      // Step 3: Cash Flow
      case 2:
        return (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-medium">Alright, real talk.</p>
                <p className="text-white/50 text-sm mt-1">
                  What is the actual amount that gets deposited into your account every month? Your take-home pay, after taxes and deductions.
                </p>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">$</span>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="number"
                placeholder="Monthly take-home (e.g. 3500)"
                value={data.monthly_take_home || ""}
                onChange={(e) => set("monthly_take_home", parseFloat(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                min="0"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
              />
            </div>
            {data.annual_income > 0 && data.monthly_take_home > 0 && (
              <p className="text-xs text-white/20">
                That&apos;s about {Math.round((data.monthly_take_home / (data.annual_income / 12)) * 100)}% of your gross monthly — {data.monthly_take_home < data.annual_income / 12 * 0.6 ? "looks like a good chunk goes to taxes and deductions" : "solid take-home ratio"}.
              </p>
            )}
          </div>
        )

      // Step 4: Home Life
      case 3:
        return (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Home className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-medium">What&apos;s your current living situation?</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "single", label: "Single" },
                { value: "couple", label: "Couple" },
                { value: "living_alone", label: "Living Alone" },
                { value: "other", label: "Other" },
              ].map((opt) => (
                <OptionBtn
                  key={opt.value}
                  label={opt.label}
                  selected={data.living_situation === opt.value}
                  onClick={() => set("living_situation", opt.value)}
                />
              ))}
            </div>

            {data.living_situation && (
              <div className="pt-2">
                <p className="text-white/50 text-sm mb-3">Do you rent, own, or neither?</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "rent", label: "Rent" },
                    { value: "own", label: "Own" },
                    { value: "other", label: "Neither" },
                  ].map((opt) => (
                    <OptionBtn
                      key={opt.value}
                      label={opt.label}
                      selected={data.housing_status === opt.value}
                      onClick={() => set("housing_status", opt.value)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      // Step 5: Goals
      case 4:
        return (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-medium">The big picture.</p>
                <p className="text-white/50 text-sm mt-1">
                  What would you say your main financial goals are?
                </p>
              </div>
            </div>

            {!showGoalHelp ? (
              <>
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  placeholder="e.g. Save $10K for a car, pay off my credit card, build an emergency fund..."
                  value={data.financial_goals}
                  onChange={(e) => set("financial_goals", e.target.value)}
                  rows={3}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all resize-none"
                />
                <button
                  type="button"
                  onClick={() => setShowGoalHelp(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-teal-400/70 hover:text-teal-300 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Not sure? Help me figure it out
                </button>
              </>
            ) : (
              <div className="space-y-4 p-4 rounded-xl border border-teal-500/20 bg-teal-500/[0.03]">
                <p className="text-sm text-white/60">
                  What&apos;s most important to you right now?
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Getting out of debt", "Saving more", "Just getting a handle on things"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        set("financial_goals", data.financial_goals ? `${data.financial_goals}. Priority: ${opt}` : `Priority: ${opt}`)
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        data.financial_goals.includes(opt)
                          ? "bg-teal-500/20 border border-teal-500/40 text-teal-300"
                          : "bg-white/[0.03] border border-white/[0.08] text-white/50 hover:bg-white/[0.06]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-white/60 mt-3">
                  If money wasn&apos;t an issue and you could do anything, what would it be?
                </p>
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  placeholder="Dream big — a house, travel, starting a business..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value
                      if (val) {
                        set("financial_goals", data.financial_goals ? `${data.financial_goals}. Dream: ${val}` : `Dream: ${val}`)
                        setShowGoalHelp(false)
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value
                    if (val) {
                      set("financial_goals", data.financial_goals ? `${data.financial_goals}. Dream: ${val}` : `Dream: ${val}`)
                    }
                  }}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowGoalHelp(false)}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Done — go back to free text
                </button>
              </div>
            )}
          </div>
        )

      // Step 6: Money Habits
      case 5:
        return (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-base font-medium">Last one, promise.</p>
                <p className="text-white/50 text-sm mt-1">
                  How would you describe your current money habits? Are you a spender, a saver, or somewhere in between?
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {["Spender", "Saver", "Somewhere in between", "Honestly, I have no idea"].map((opt) => (
                <OptionBtn
                  key={opt}
                  label={opt}
                  selected={data.money_habits === opt.toLowerCase()}
                  onClick={() => set("money_habits", opt.toLowerCase())}
                />
              ))}
            </div>
            {data.money_habits && (
              <textarea
                placeholder="Want to add anything? (optional)"
                onChange={(e) => {
                  if (e.target.value) {
                    set("money_habits", `${data.money_habits}. ${e.target.value}`)
                  }
                }}
                rows={2}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all resize-none text-sm"
              />
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center relative overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {step === 0 ? "Let's get to know you" : `Step ${step + 1} of ${TOTAL_STEPS}`}
          </h1>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6">
          {renderStep()}

          {error && (
            <p className="text-red-400 text-sm mt-3">{error}</p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => { setStep(step - 1); setShowGoalHelp(false) }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm font-medium hover:bg-white/[0.05] hover:text-white/70 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-all"
            >
              {loading ? (
                "Setting up..."
              ) : step === TOTAL_STEPS - 1 ? (
                <>
                  Launch Aurora
                  <Sparkles className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step hint */}
        <p className="text-center text-xs text-white/15 mt-4">
          Press Enter to continue
        </p>
      </div>
    </div>
  )
}
