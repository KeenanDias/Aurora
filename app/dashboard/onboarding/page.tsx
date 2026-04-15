"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeOnboarding } from "./actions"
import { ArrowRight, Sparkles, Briefcase, DollarSign, User } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await completeOnboarding(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  const steps = [
    {
      icon: User,
      label: "What should we call you?",
      field: "name",
      placeholder: "Your first name",
      type: "text",
    },
    {
      icon: Briefcase,
      label: "What do you do for work?",
      placeholder: "e.g. Software Engineer, Teacher, Freelancer",
      field: "job",
      type: "text",
    },
    {
      icon: DollarSign,
      label: "What's your monthly income?",
      placeholder: "e.g. 4500",
      field: "income",
      type: "number",
    },
  ]

  return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center relative overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-transparent rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 mx-auto mb-5">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Let&apos;s get to know you
          </h1>
          <p className="text-white/50 text-sm">
            This helps Aurora give you personalized financial advice.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i <= step
                  ? "w-8 bg-gradient-to-r from-emerald-400 to-teal-400"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6">
            {steps.map((s, i) => (
              <div
                key={s.field}
                className={`transition-all duration-500 ${
                  i === step
                    ? "opacity-100 translate-y-0"
                    : i < step
                    ? "hidden"
                    : "hidden"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <Label htmlFor={s.field} className="text-white text-base font-medium">
                    {s.label}
                  </Label>
                </div>
                <Input
                  id={s.field}
                  name={s.field}
                  type={s.type}
                  placeholder={s.placeholder}
                  required
                  min={s.type === "number" ? "0" : undefined}
                  step={s.type === "number" ? "0.01" : undefined}
                  className="bg-white/[0.05] border-white/10 text-white placeholder:text-white/25 h-12 text-base focus-visible:ring-teal-500/30 focus-visible:border-teal-500/50"
                />
              </div>
            ))}

            {error && (
              <p className="text-red-400 text-sm mt-3">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="border-white/10 text-white/60 hover:bg-white/[0.05] hover:text-white"
                >
                  Back
                </Button>
              )}

              {step < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById(steps[step].field) as HTMLInputElement
                    if (input && input.value.trim()) {
                      setStep(step + 1)
                    } else {
                      input?.focus()
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 border-0 text-white font-medium h-12"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 border-0 text-white font-medium h-12"
                >
                  {loading ? "Setting up..." : "Launch Aurora"}
                  <Sparkles className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
