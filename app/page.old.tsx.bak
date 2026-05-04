"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Target,
  BarChart3,
  ChevronRight,
  Sparkles,
  Bell,
  Lock,
  Trophy,
  Brain,
  X,
  Check,
  Star,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"

/* ─── Kit email signup ─── */
function KitEmailForm() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (mounted && containerRef.current) {
      const existingScript = containerRef.current.querySelector("script")
      if (!existingScript) {
        const script = document.createElement("script")
        script.async = true
        script.setAttribute("data-uid", "a3573121a0")
        script.src = "https://aurora-23.kit.com/a3573121a0/index.js"
        containerRef.current.appendChild(script)
      }
    }
  }, [mounted])

  if (!mounted) return <div className="min-h-[50px]" />
  return <div ref={containerRef} className="w-full max-w-md mx-auto" />
}

/* ─── Early‑access modal ─── */
function EarlyAccessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset"
    return () => { document.body.style.overflow = "unset" }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1120]/95 backdrop-blur-xl p-6 shadow-2xl shadow-teal-500/10 animate-in fade-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Join the Waitlist</h3>
          <p className="text-white/60 text-sm">Be the first to experience Aurora and take control of your financial future.</p>
        </div>
        <div className="flex justify-center">
          <KitEmailForm />
        </div>
      </div>
    </div>
  )
}

/* ─── Hooks ─── */
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true) },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, isInView }
}

/* ─── Aurora background component ─── */
function AuroraBackground({ intensity = "normal" }: { intensity?: "normal" | "intense" }) {
  const opacityClass = intensity === "intense" ? "opacity-80" : "opacity-50"
  return (
    <div className={`absolute inset-0 pointer-events-none ${opacityClass}`}>
      <div
        className="absolute -top-1/4 left-0 w-full h-[70%]"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 30% 20%, rgba(16,185,129,0.3) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 70% 15%, rgba(6,182,212,0.25) 0%, transparent 55%), radial-gradient(ellipse 70% 45% at 50% 10%, rgba(139,92,246,0.2) 0%, transparent 50%)",
          animation: "aurora-shift 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -top-1/4 left-0 w-full h-[60%]"
        style={{
          background: "radial-gradient(ellipse 60% 35% at 60% 25%, rgba(20,184,166,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 30% at 35% 20%, rgba(168,85,247,0.18) 0%, transparent 50%)",
          animation: "aurora-shift-2 15s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -top-1/4 left-0 w-full h-[55%]"
        style={{
          background: "radial-gradient(ellipse 55% 30% at 45% 18%, rgba(236,72,153,0.12) 0%, transparent 50%)",
          animation: "aurora-shift-3 18s ease-in-out infinite",
        }}
      />
    </div>
  )
}

/* ─── Star field ─── */
function StarField() {
  const [stars, setStars] = useState<Array<{ left: number; top: number; delay: number; duration: number; size: number }>>([])

  useEffect(() => {
    setStars(
      Array.from({ length: 60 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 4,
        size: Math.random() > 0.8 ? 2 : 1,
      }))
    )
  }, [])

  if (stars.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/40"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Header ─── */
function Header() {
  const { isSignedIn } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#0b1120]/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              {[
                { href: "#problem", label: "Problem" },
                { href: "#how-it-works", label: "How It Works" },
                { href: "#features", label: "Features" },
                { href: "#testimonials", label: "Testimonials" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/50 hover:text-emerald-300 transition-colors duration-300"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              {isSignedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className="hidden sm:inline-flex text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link href="/sign-out">
                    <Button
                      size="sm"
                      className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium"
                    >
                      Sign out
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="hidden sm:inline-flex text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Sign in
                  </Link>
                  <Button
                    size="sm"
                    className="rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 border-0 shadow-lg shadow-teal-500/25 text-white font-medium"
                    onClick={() => setShowModal(true)}
                  >
                    Get Early Access
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <EarlyAccessModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}

/* ─── Hero ─── */
function HeroSection() {
  const { ref, isInView } = useInView()
  const [titleIndex, setTitleIndex] = useState(0)
  const titles = ["Early Access", "Your Future", "Financial Freedom"]

  useEffect(() => {
    const interval = setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % titles.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [titles.length])

  return (
    <section ref={ref} className="relative pt-32 pb-24 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-screen flex items-center">
      <div className="absolute inset-0 bg-gradient-to-b from-[#040d1a] via-[#0b1120] to-[#0b1120]" />
      <AuroraBackground intensity="intense" />
      <StarField />

      <div
        className={`max-w-5xl mx-auto text-center relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-sm text-emerald-300 text-sm font-medium mb-8 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <Sparkles className="w-4 h-4" />
          Now accepting early access signups
        </div>

        <div className="mb-8">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-4">
            <span className="block text-white/90">Welcome to</span>
            <span
              key={titleIndex}
              className="block bg-gradient-to-r from-emerald-300 via-teal-300 to-violet-400 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700"
            >
              {titles[titleIndex]}
            </span>
          </h1>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-5 mb-8 text-2xl sm:text-3xl lg:text-4xl font-bold text-white/80">
          <span>Chaos</span>
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-rose-400" />
          <span>Control</span>
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" />
          <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">Growth</span>
        </div>

        <p className="text-xl sm:text-2xl text-white/60 mb-4 font-medium">
          We don&apos;t just track your money. We coach you on how to use it.
        </p>

        <p className="text-lg text-white/40 mb-12 max-w-2xl mx-auto text-pretty">
          <span className="font-semibold bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">Aurora</span>{" "}
          is an AI financial coach that helps you spend smarter, stay in control, and build real wealth.
        </p>

        <div className="w-full flex justify-center">
          <KitEmailForm />
        </div>

        <a
          href="#problem"
          className="inline-flex items-center gap-2 mt-10 text-sm text-white/40 hover:text-emerald-300 transition-colors group"
        >
          Scroll to explore
          <ArrowRight className="w-4 h-4 rotate-90 group-hover:translate-y-1 transition-transform" />
        </a>
      </div>
    </section>
  )
}

/* ─── Problem ─── */
function ProblemSection() {
  const { ref, isInView } = useInView(0.2)
  const problems = [
    { text: "You don't know what you can safely spend", icon: DollarSign },
    { text: "Budgeting feels overwhelming or confusing", icon: BarChart3 },
    { text: "You track money, but nothing actually changes", icon: Target },
    { text: "You have goals but aren't sure how to reach them", icon: TrendingUp },
  ]

  return (
    <section id="problem" ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b1120]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-br from-rose-500/8 via-pink-500/5 to-transparent rounded-full blur-[150px] pointer-events-none" />

      <div
        className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 text-balance">
          Most People Feel{" "}
          <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
            Out of Control
          </span>{" "}
          With Money
        </h2>
        <p className="text-lg text-white/40 mb-12 max-w-xl mx-auto">Sound familiar? You&apos;re not alone.</p>

        <div className="space-y-4 mb-14">
          {problems.map((problem, index) => (
            <div
              key={index}
              className={`flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] max-w-xl mx-auto transition-all duration-700 hover:bg-white/[0.06] hover:border-rose-500/20 group ${
                isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500/15 to-pink-500/15 flex items-center justify-center flex-shrink-0 border border-rose-500/20 group-hover:border-rose-500/40 transition-colors">
                <problem.icon className="w-5 h-5 text-rose-400" />
              </div>
              <p className="text-left text-white/80 font-medium text-base sm:text-lg">{problem.text}</p>
            </div>
          ))}
        </div>

        <p className="text-2xl text-white/40 font-medium">
          Tracking isn&apos;t enough. <span className="text-white">You need guidance.</span>
        </p>
      </div>
    </section>
  )
}

/* ─── Transformation ─── */
function TransformationSection() {
  const { ref, isInView } = useInView(0.2)
  const steps = [
    {
      icon: Zap,
      title: "CHAOS",
      description: "No clarity. Overspending. Financial stress.",
      gradient: "from-rose-400 to-pink-500",
      glow: "shadow-rose-500/20",
    },
    {
      icon: Shield,
      title: "CONTROL",
      description: "Know exactly what you can spend and where you stand.",
      gradient: "from-teal-400 to-cyan-500",
      glow: "shadow-teal-500/20",
    },
    {
      icon: TrendingUp,
      title: "GROWTH",
      description: "Save more, invest smarter, and build wealth automatically.",
      gradient: "from-emerald-400 to-teal-500",
      glow: "shadow-emerald-500/20",
    },
  ]

  return (
    <section ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b1120]" />
      <AuroraBackground />

      <div
        className={`max-w-5xl mx-auto relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 text-center text-balance">
          The{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
            Transformation
          </span>
        </h2>
        <p className="text-lg text-white/40 text-center mb-16 max-w-2xl mx-auto">
          Your journey from financial stress to financial freedom
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`relative transition-all duration-700 ${
                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <Card className={`h-full border-0 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-all duration-500 hover:scale-[1.03] group shadow-xl ${step.glow}`}>
                <CardContent className="p-8 text-center relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 blur-xl`} />
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-6 shadow-lg relative z-10`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-xs font-bold tracking-widest text-white/30 relative z-10">{step.title}</span>
                  <p className="mt-4 text-white/70 font-medium text-lg relative z-10">{step.description}</p>
                </CardContent>
              </Card>
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 transform -translate-y-1/2 z-20">
                  <ChevronRight className="w-8 h-8 text-teal-400/60" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── How it works (chat + dashboard demo) ─── */
function HowItWorksSection() {
  const { ref, isInView } = useInView(0.15)
  const [visibleMessages, setVisibleMessages] = useState<number[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [animatedCategories, setAnimatedCategories] = useState<number[]>([])
  const [safeToSpend, setSafeToSpend] = useState(0)
  const [monthlySpent, setMonthlySpent] = useState(0)
  const [goalProgress, setGoalProgress] = useState(0)

  const conversation = [
    { role: "ai", content: "Hey! I just connected to your bank and crunched the numbers. Ready to see where your money's been going?" },
    { role: "user", content: "Yes! Show me what you found" },
    { role: "ai", content: "I found 847 transactions from the last 3 months! Let me categorize these for you..." },
    { role: "ai", content: "Here's your spending breakdown! Check out your dashboard.", showDashboard: true },
    { role: "user", content: "Can I afford dinner out tonight?" },
    { role: "ai", content: "You've got $127 safe-to-spend left this week. Dinner's totally doable — just maybe skip the fancy cocktails!" },
    { role: "user", content: "How can I save more for my vacation?" },
    { role: "ai", content: "I noticed you spend more on weekends. I'll nudge you Friday mornings! Also, you have $180/mo on subscriptions — want me to find unused ones?" },
  ]

  const spendingCategories = [
    { emoji: "🍔", name: "Food & Dining", amount: 847, budget: 900, color: "from-orange-400 to-amber-500" },
    { emoji: "🎉", name: "Entertainment", amount: 234, budget: 300, color: "from-pink-400 to-rose-500" },
    { emoji: "🏠", name: "Housing", amount: 1850, budget: 1850, color: "from-blue-400 to-indigo-500" },
    { emoji: "🚗", name: "Transport", amount: 312, budget: 400, color: "from-emerald-400 to-teal-500" },
    { emoji: "🛍️", name: "Shopping", amount: 189, budget: 250, color: "from-violet-400 to-purple-500" },
  ]

  useEffect(() => {
    if (showDashboard) {
      const duration = 1500
      const steps = 30
      const interval = duration / steps
      let step = 0
      const timer = setInterval(() => {
        step++
        const p = step / steps
        setSafeToSpend(Math.round(127 * p))
        setMonthlySpent(Math.round(4187 * p))
        setGoalProgress(Math.round(75 * p))
        if (step >= steps) clearInterval(timer)
      }, interval)
      return () => clearInterval(timer)
    }
  }, [showDashboard])

  useEffect(() => {
    if (!isInView || hasStarted) return
    setHasStarted(true)

    let currentIndex = 0
    const showNextMessage = () => {
      if (currentIndex >= conversation.length) return
      const msg = conversation[currentIndex]

      if (msg.role === "ai") {
        setIsTyping(true)
        setTimeout(() => {
          setIsTyping(false)
          setVisibleMessages((prev) => [...prev, currentIndex])
          if (msg.showDashboard) {
            setTimeout(() => {
              setShowDashboard(true)
              spendingCategories.forEach((_, i) => {
                setTimeout(() => setAnimatedCategories((prev) => [...prev, i]), i * 150)
              })
            }, 400)
          }
          currentIndex++
          setTimeout(showNextMessage, msg.showDashboard ? 3000 : 1200)
        }, 1500)
      } else {
        setVisibleMessages((prev) => [...prev, currentIndex])
        currentIndex++
        setTimeout(showNextMessage, 800)
      }
    }

    setTimeout(showNextMessage, 1000)
  }, [isInView, hasStarted])

  return (
    <section id="how-it-works" ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b1120]" />
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[500px] h-[400px] bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[400px] bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-transparent rounded-full blur-[120px]" />
      </div>

      <div
        className={`max-w-6xl mx-auto relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 text-center text-balance">
          How It Works
        </h2>
        <p className="text-lg text-white/40 text-center mb-6 max-w-2xl mx-auto">
          <span className="font-semibold bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">Aurora</span>{" "}
          connects to your bank, learns your patterns, and proactively coaches you.
        </p>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-4 mb-14 flex-wrap">
          {[
            { icon: Lock, label: "256-bit Encryption", color: "emerald" },
            { icon: Shield, label: "Read-Only Access", color: "cyan" },
            { icon: Lock, label: "SOC 2 Compliant", color: "violet" },
          ].map((badge) => (
            <div
              key={badge.label}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${badge.color}-500/10 border border-${badge.color}-500/20`}
            >
              <badge.icon className={`w-3.5 h-3.5 text-${badge.color}-400`} />
              <span className={`text-xs text-${badge.color}-300 font-medium`}>{badge.label}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Chat */}
          <Card className="border border-white/[0.06] shadow-2xl shadow-teal-500/5 overflow-hidden bg-[#0d1525]/80 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-violet-500/5">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
                <span className="font-bold text-sm bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">Aurora</span>
                <span className="text-xs text-white/30">Your Coach</span>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-400">Online</span>
                </div>
              </div>

              <div className="p-4 space-y-3 min-h-[400px] max-h-[400px] overflow-y-auto bg-gradient-to-b from-[#0b1120]/50 to-[#0b1120]/80">
                {conversation.map(
                  (message, index) =>
                    visibleMessages.includes(index) && (
                      <div
                        key={index}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-3 duration-500`}
                      >
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            message.role === "user"
                              ? "rounded-br-md bg-gradient-to-br from-emerald-500/60 via-teal-500/50 to-cyan-500/40 border border-white/10 text-white shadow-lg shadow-teal-500/10"
                              : "rounded-bl-md bg-white/[0.05] border border-white/[0.06] text-white/85"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    )
                )}
                {isTyping && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div className="rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.05] px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-teal-400/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-teal-400/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-teal-400/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/[0.04] bg-[#0b1120]/60">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/30 text-xs border border-white/[0.04] bg-white/[0.02]">
                  <MessageSquare className="w-3 h-3" />
                  Chat with Aurora...
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard */}
          <div className={`transition-all duration-700 ${showDashboard ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <Card className="border border-white/[0.06] shadow-2xl shadow-emerald-500/5 overflow-hidden bg-[#0d1525]/80 backdrop-blur-xl">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    <span className="font-semibold text-white text-sm">Your Dashboard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Live</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Top widgets */}
                  {animatedCategories.length >= 2 && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-500">
                      <div className="p-4 rounded-xl border border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.06] to-teal-500/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-[11px] text-white/40 font-medium">Safe to Spend</p>
                        </div>
                        <p className="text-3xl font-bold text-emerald-400 tabular-nums">${safeToSpend}</p>
                        <p className="text-[11px] text-white/30 mt-1">this week</p>
                      </div>
                      <div className="p-4 rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/[0.06] to-blue-500/[0.03]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-[11px] text-white/40 font-medium">Spent This Month</p>
                        </div>
                        <p className="text-3xl font-bold text-cyan-400 tabular-nums">${monthlySpent.toLocaleString()}</p>
                        <p className="text-[11px] text-white/30 mt-1">of $5,000 budget</p>
                      </div>
                    </div>
                  )}

                  {/* Goals */}
                  {animatedCategories.length >= 4 && (
                    <div className="p-4 rounded-xl border border-violet-500/10 bg-gradient-to-br from-violet-500/[0.04] to-purple-500/[0.02] animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center">
                            <Target className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-[11px] text-white/40 font-medium">Vacation Fund</p>
                        </div>
                        <span className="text-xs text-violet-400 font-semibold tabular-nums">{goalProgress}%</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${goalProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Spending categories */}
                  <div className="space-y-2">
                    <p className="text-[11px] text-white/30 font-medium px-1">Spending by Category</p>
                    {spendingCategories.map((category, index) => (
                      <div
                        key={index}
                        className={`transition-all duration-500 ${
                          animatedCategories.includes(index) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{category.emoji}</span>
                            <span className="text-[11px] text-white/70 font-medium">{category.name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[11px] font-semibold ${category.amount > category.budget ? "text-rose-400" : "text-white/80"}`}>
                              ${category.amount}
                            </span>
                            <span className="text-[11px] text-white/30"> / ${category.budget}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-1000 ease-out`}
                            style={{
                              width: animatedCategories.includes(index) ? `${Math.min((category.amount / category.budget) * 100, 100)}%` : "0%",
                              transitionDelay: `${index * 100}ms`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Features ─── */
function FeaturesSection() {
  const { ref, isInView } = useInView(0.2)
  const features = [
    { icon: DollarSign, title: "Real-Time Decisions", description: "Know instantly if you can afford something without breaking your budget.", gradient: "from-emerald-400 to-teal-500" },
    { icon: Target, title: "Daily Safe-to-Spend", description: "Always know your limit. No more guessing or end-of-month surprises.", gradient: "from-cyan-400 to-blue-500" },
    { icon: MessageSquare, title: "AI Coaching", description: "Personalized guidance based on your behavior, goals, and spending patterns.", gradient: "from-violet-400 to-purple-500" },
    { icon: BarChart3, title: "Progress Tracking", description: "See yourself move from chaos to growth with clear visual progress.", gradient: "from-teal-400 to-emerald-500" },
    { icon: Brain, title: "Predictive Nudges", description: "Aurora learns your patterns and sends proactive reminders before you overspend.", gradient: "from-violet-400 to-pink-500" },
    { icon: Trophy, title: "Milestone Rewards", description: "Earn achievements as you hit savings goals and build better habits.", gradient: "from-amber-400 to-orange-500" },
  ]

  return (
    <section id="features" ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b1120]" />
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/3 left-0 w-full h-48 bg-gradient-to-r from-emerald-500/25 via-teal-500/30 to-violet-500/25 blur-[120px]" />
      </div>

      <div
        className={`max-w-5xl mx-auto relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 text-center text-balance">
          Everything You Need
        </h2>
        <p className="text-lg text-white/40 text-center mb-16 max-w-2xl mx-auto">
          Powerful features designed to transform how you manage money
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <Card
              key={index}
              className={`border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.05] transition-all duration-500 hover:scale-[1.02] group ${
                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg relative z-10`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 relative z-10">{feature.title}</h3>
                <p className="text-sm text-white/50 relative z-10 leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Testimonials ─── */
function TestimonialsSection() {
  const { ref, isInView } = useInView(0.2)
  const testimonials = [
    { quote: "This changed how I think about money. I finally understand where every dollar goes.", author: "Sarah M.", role: "Marketing Manager", gradient: "from-emerald-400 to-teal-500" },
    { quote: "I finally feel in control. The AI coaching is like having a financial advisor in my pocket.", author: "James L.", role: "Software Engineer", gradient: "from-cyan-400 to-blue-500" },
    { quote: "Went from constant overdrafts to actually saving. Aurora made it click for me.", author: "Emily R.", role: "Freelance Designer", gradient: "from-violet-400 to-purple-500" },
    { quote: "The safe-to-spend feature alone is worth it. I never have to guess anymore.", author: "Michael T.", role: "Product Manager", gradient: "from-teal-400 to-cyan-500" },
    { quote: "Been using it for 3 months. Already saved more than I did all last year combined.", author: "Lisa K.", role: "Teacher", gradient: "from-blue-400 to-indigo-500" },
    { quote: "Finally an app that doesn't just track but actually helps. Game changer.", author: "David P.", role: "Startup Founder", gradient: "from-emerald-400 to-cyan-500" },
  ]

  return (
    <section id="testimonials" ref={ref} className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b1120]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-gradient-to-br from-teal-500/8 via-cyan-500/5 to-transparent rounded-full blur-[150px] pointer-events-none" />

      <div
        className={`max-w-5xl mx-auto relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-14 text-center text-balance">
          What{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">Early Users</span>{" "}
          Are Saying
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className={`border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.05] transition-all duration-500 hover:scale-[1.02] ${
                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 75}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-white/70 mb-5 leading-relaxed text-sm">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white font-semibold text-xs shadow-lg`}>
                    {testimonial.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{testimonial.author}</p>
                    <p className="text-xs text-white/30">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Final CTA ─── */
function FinalCTASection() {
  const { ref, isInView } = useInView(0.2)

  return (
    <section ref={ref} className="relative py-32 sm:py-40 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b1120]" />
      <AuroraBackground intensity="intense" />

      <div
        className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-1000 ${
          isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white mb-8 text-balance">
          Stop Guessing.{" "}
          <span className="block mt-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-violet-400 bg-clip-text text-transparent">
            Start Taking Control.
          </span>
        </h2>
        <p className="text-xl text-white/40 mb-12 max-w-xl mx-auto">
          Join thousands transforming their relationship with money.
        </p>

        <KitEmailForm />
      </div>
    </section>
  )
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-white/[0.06] bg-[#060d1a]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/15">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <span className="font-bold bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">Aurora</span>
              <p className="text-sm text-white/30">AI Financial Coach</p>
            </div>
          </div>
          <p className="text-sm text-white/30">{`\u00A9 ${new Date().getFullYear()} Aurora. All rights reserved.`}</p>
        </div>
        <div className="mt-8 pt-6 border-t border-white/[0.04]">
          <p className="text-xs text-white/20 text-center leading-relaxed max-w-4xl mx-auto">
            This website and any information provided by our AI financial coach are for educational and informational purposes only. We do not provide financial, investment, or legal advice. Any suggestions or insights are not personalized financial advice and should not be relied upon as a substitute for consulting with a qualified professional. You are responsible for your own financial decisions.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ─── Page ─── */
export default function LandingPage() {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth"
    return () => { document.documentElement.style.scrollBehavior = "auto" }
  }, [])

  return (
    <div className="min-h-screen bg-[#0b1120]">
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <TransformationSection />
        <HowItWorksSection />
        <FeaturesSection />
        <TestimonialsSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  )
}
