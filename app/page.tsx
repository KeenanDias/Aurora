"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Zap, Shield, TrendingUp, MessageSquare, DollarSign, Target, BarChart3, ChevronRight, Sparkles, Bell, Lock, Trophy, Brain, Smartphone, X } from "lucide-react"

// Kit email signup form component - directly embeds the Kit script
function KitEmailForm() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  useEffect(() => {
    if (mounted && containerRef.current) {
      // Check if script already exists in this container
      const existingScript = containerRef.current.querySelector('script')
      if (!existingScript) {
        const script = document.createElement('script')
        script.async = true
        script.setAttribute('data-uid', 'a3573121a0')
        script.src = 'https://aurora-23.kit.com/a3573121a0/index.js'
        containerRef.current.appendChild(script)
      }
    }
  }, [mounted])
  
  if (!mounted) {
    return <div className="min-h-[50px]" />
  }
  
  return (
    <div ref={containerRef} className="w-full max-w-md mx-auto" />
  )
}

// Modal for early access signup
function EarlyAccessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl shadow-teal-500/10 animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
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

// Hero email signup - inline Kit form
function HeroEmailCTA() {
  return (
    <div className="w-full flex justify-center">
      <KitEmailForm />
    </div>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/25">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400 bg-clip-text text-transparent">Aurora</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#problem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Problem
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
            </nav>
            <Button 
              variant="default" 
              size="sm" 
              className="rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 border-0 shadow-lg shadow-teal-500/25"
              onClick={() => setShowModal(true)}
            >
              Get Early Access
            </Button>
          </div>
        </div>
      </header>
      <EarlyAccessModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
        }
      },
      { threshold }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold])

  return { ref, isInView }
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const currentProgress = window.scrollY / scrollHeight
      setProgress(currentProgress)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return progress
}

function useParallax(speed = 0.5) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        const scrolled = window.innerHeight - rect.top
        setOffset(scrolled * speed)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [speed])

  return { ref, offset }
}

function HeroSection() {
  const { ref, isInView } = useInView()
  const scrollProgress = useScrollProgress()
  const [titleIndex, setTitleIndex] = useState(0)
  const [stars, setStars] = useState<Array<{left: number, top: number, delay: number, duration: number}>>([])
  
  const titles = ["Early Access", "Your Future", "Financial Freedom"]

  useEffect(() => {
    // Generate stars on client side to avoid hydration mismatch
    setStars(Array.from({ length: 50 }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
    })))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % titles.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [titles.length])

  return (
    <section ref={ref} className="relative pt-32 pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-screen flex items-center">
      {/* Aurora gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pointer-events-none" />
      
      {/* Northern lights effect */}
      <div 
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{ transform: `translateY(${scrollProgress * -100}px)` }}
      >
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-transparent rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[350px] bg-gradient-to-br from-cyan-500/25 via-blue-500/15 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-40 left-1/2 w-[400px] h-[300px] bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-20 right-1/3 w-[450px] h-[350px] bg-gradient-to-br from-teal-400/25 via-emerald-400/15 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>
      
      {/* Starfield effect - only render after client-side hydration */}
      {stars.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {stars.map((star, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/30 rounded-full animate-pulse"
              style={{
                left: `${star.left}%`,
                top: `${star.top}%`,
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
              }}
            />
          ))}
        </div>
      )}
      
      <div 
        className={`max-w-5xl mx-auto text-center relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
        style={{ transform: `translateY(${scrollProgress * 50}px)` }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm text-emerald-300 text-sm font-medium mb-8 border border-emerald-500/20">
          <Sparkles className="w-4 h-4" />
          Now accepting early access signups
        </div>
        
        {/* Large animated headline */}
        <div className="mb-8 overflow-hidden">
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-4">
            <span className="block text-white/90">Welcome to</span>
            <span 
              key={titleIndex}
              className="block bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-700"
            >
              {titles[titleIndex]}
            </span>
          </h1>
        </div>
        
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 text-2xl sm:text-3xl lg:text-4xl font-bold text-white/80">
          <span>Chaos</span>
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
          <span>Control</span>
          <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Growth</span>
        </div>
        
        <p className="text-xl sm:text-2xl text-white/60 mb-4 font-medium">
          {"We don't just track your money. We coach you on how to use it."}
        </p>
        
        <p className="text-lg text-white/50 mb-12 max-w-2xl mx-auto text-pretty">
          <span className="font-semibold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Aurora</span> is an AI financial coach that helps you spend smarter, stay in control, and build real wealth.
        </p>

        <HeroEmailCTA />

        <a
          href="#problem"
          className="inline-flex items-center gap-2 mt-10 text-sm text-white/50 hover:text-emerald-400 transition-colors group"
        >
          Scroll to explore
          <ArrowRight className="w-4 h-4 rotate-90 group-hover:translate-y-1 transition-transform" />
        </a>
      </div>
    </section>
  )
}

function ProblemSection() {
  const { ref, isInView } = useInView(0.2)
  const { ref: parallaxRef, offset } = useParallax(0.1)
  const problems = [
    "You don't know what you can safely spend",
    "Budgeting feels overwhelming or confusing",
    "You track money, but nothing actually changes",
    "You have goals but aren't sure how to get to them",
  ]

  return (
    <section id="problem" ref={ref} className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div ref={parallaxRef} className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 pointer-events-none" />
      
      {/* Subtle aurora glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent rounded-full blur-[120px] pointer-events-none"
        style={{ transform: `translate(-50%, -50%) translateY(${offset * 0.5}px)` }}
      />
      
      <div className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-12 text-balance">
          Most People Feel{" "}
          <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">Out of Control</span>{" "}
          With Money
        </h2>

        <div className="space-y-5 mb-12">
          {problems.map((problem, index) => (
            <div
              key={index}
              className={`flex items-center gap-4 p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 max-w-xl mx-auto transition-all duration-700 hover:bg-white/10 hover:border-rose-500/30 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 border border-rose-500/30">
                <span className="text-rose-400 font-bold">{index + 1}</span>
              </div>
              <p className="text-left text-white/90 font-medium text-lg">{problem}</p>
            </div>
          ))}
        </div>

        <p className="text-2xl text-white/50 font-medium">
          {"Tracking isn't enough. "}
          <span className="text-white">You need guidance.</span>
        </p>
      </div>
    </section>
  )
}

function TransformationSection() {
  const { ref, isInView } = useInView(0.2)
  const { ref: parallaxRef, offset } = useParallax(0.1)
  const steps = [
    {
      icon: Zap,
      title: "CHAOS",
      description: "No clarity. Overspending. Financial stress.",
      gradient: "from-rose-400 to-pink-500",
      glowColor: "rose",
    },
    {
      icon: Shield,
      title: "CONTROL",
      description: "Know exactly what you can spend and where you stand.",
      gradient: "from-blue-400 to-indigo-500",
      glowColor: "blue",
    },
    {
      icon: TrendingUp,
      title: "GROWTH",
      description: "Save more, invest smarter, and build wealth automatically.",
      gradient: "from-emerald-400 to-teal-500",
      glowColor: "emerald",
    },
  ]

  return (
    <section ref={ref} className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div ref={parallaxRef} className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pointer-events-none" />
      
      {/* Aurora streaks */}
      <div 
        className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none"
        style={{ transform: `translateY(${offset * 0.3}px)` }}
      >
        <div className="absolute top-1/4 left-0 w-full h-32 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent blur-[80px]" />
        <div className="absolute top-1/2 left-0 w-full h-24 bg-gradient-to-r from-transparent via-teal-500/15 to-transparent blur-[60px]" />
      </div>
      
      <div className={`max-w-5xl mx-auto relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 text-center text-balance">
          The{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Transformation</span>
        </h2>
        <p className="text-xl text-white/50 text-center mb-16 max-w-2xl mx-auto">
          Your journey from financial stress to financial freedom
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className={`relative transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <Card className="h-full border-0 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-500 hover:scale-[1.03] group">
                <CardContent className="p-8 text-center relative overflow-hidden">
                  {/* Glow effect on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`} />
                  
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-6 shadow-lg shadow-${step.glowColor}-500/30 relative z-10`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-xs font-bold tracking-widest text-white/40 relative z-10">{step.title}</span>
                  <p className="mt-4 text-white/80 font-medium text-lg relative z-10">{step.description}</p>
                </CardContent>
              </Card>
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 transform -translate-y-1/2 z-20">
                  <ChevronRight className="w-8 h-8 text-teal-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const { ref, isInView } = useInView(0.2)
  const { ref: parallaxRef, offset } = useParallax(0.1)
  const [visibleMessages, setVisibleMessages] = useState<number[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [animatedCategories, setAnimatedCategories] = useState<number[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [visibleNotifications, setVisibleNotifications] = useState<number[]>([])
  const [isPullingData, setIsPullingData] = useState(false)
  const [dataProgress, setDataProgress] = useState(0)
  const [safeToSpend, setSafeToSpend] = useState(0)
  const [monthlySpent, setMonthlySpent] = useState(0)
  const [goalProgress, setGoalProgress] = useState(0)
  const [currentNotification, setCurrentNotification] = useState(-1)
  
  const conversation = [
    { role: "ai", content: "Hey! 👋 I just connected to your bank and crunched the numbers. Ready to see where your money's been going? 📊" },
    { role: "user", content: "Yes! Show me what you found" },
    { role: "ai", content: "Pulling in your transactions now... I found 847 transactions from the last 3 months! Let me categorize these for you real quick 🔄" },
    { role: "ai", content: "Here's your spending breakdown! I've organized everything into categories for you 🎯", showDashboard: true },
    { role: "user", content: "Wow that's so helpful! Can I afford dinner out tonight?" },
    { role: "ai", content: "Absolutely! 🎉 You've got $127 safe-to-spend left this week. Dinner's totally doable—just maybe skip the fancy cocktails and you're golden! 🍝✨" },
    { role: "user", content: "How can I save more for my vacation?" },
    { role: "ai", content: "Love that you're planning ahead! 🏖️ Looking at your spending patterns, I noticed you tend to spend more on weekends. I'll send you a friendly nudge on Friday mornings to help you stay on track! 💪 Also, I see $180/month on subscriptions—want me to help you find ones you might not be using? 🔍" },
    { role: "user", content: "That would be great!" },
    { role: "ai", content: "Perfect! 🙌 I found 3 subscriptions you haven't used in over a month: Spotify ($9.99), Adobe ($22.99), and a gym membership ($45). That's $78/month you could be saving! Want me to remind you to cancel them? 💰" },
  ]

  const predictiveNotifications = [
    { time: "Just now", title: "Weekend heads up! 🎯", message: "Hey! You usually spend $80 more on weekends. Your safe-to-spend is $127—want to set a weekend budget?", icon: "brain" },
    { time: "Just now", title: "Coffee shop pattern ☕", message: "I noticed you grab coffee every Monday. That's $24/week—should I factor this into your budget?", icon: "bell" },
    { time: "Just now", title: "Subscription alert 🔔", message: "Netflix just charged $15.99. You haven't watched in 3 weeks—want to pause it?", icon: "bell" },
    { time: "Just now", title: "Goal milestone! 🎉", message: "You're 75% to your vacation fund! At this rate, you'll hit it 2 weeks early!", icon: "trophy" },
  ]

  const spendingCategories = [
    { emoji: "🍔", name: "Food & Dining", amount: 847, budget: 900, color: "from-orange-400 to-amber-500" },
    { emoji: "🎉", name: "Entertainment", amount: 234, budget: 300, color: "from-pink-400 to-rose-500" },
    { emoji: "🏠", name: "Housing", amount: 1850, budget: 1850, color: "from-blue-400 to-indigo-500" },
    { emoji: "🚗", name: "Transport", amount: 312, budget: 400, color: "from-emerald-400 to-teal-500" },
    { emoji: "💳", name: "Debt Payments", amount: 450, budget: 450, color: "from-red-400 to-rose-500" },
    { emoji: "🛍️", name: "Shopping", amount: 189, budget: 250, color: "from-violet-400 to-purple-500" },
    { emoji: "💊", name: "Health", amount: 125, budget: 200, color: "from-cyan-400 to-blue-500" },
    { emoji: "📱", name: "Subscriptions", amount: 180, budget: 150, color: "from-teal-400 to-emerald-500" },
  ]

  // Count up animation
  useEffect(() => {
    if (showDashboard) {
      const duration = 1500
      const steps = 30
      const interval = duration / steps
      let step = 0
      
      const countUpTimer = setInterval(() => {
        step++
        const progress = step / steps
        setSafeToSpend(Math.round(127 * progress))
        setMonthlySpent(Math.round(4187 * progress))
        setGoalProgress(Math.round(75 * progress))
        
        if (step >= steps) {
          clearInterval(countUpTimer)
        }
      }, interval)
      
      return () => clearInterval(countUpTimer)
    }
  }, [showDashboard])
  
  // Continuous fluctuation after initial count, then settle
  useEffect(() => {
    if (!showDashboard) return
    
    let fluctuateTimer: ReturnType<typeof setInterval>
    let tickCount = 0
    const maxTicks = 10
    
    // Wait for count up to finish, then fluctuate
    const startDelay = setTimeout(() => {
      fluctuateTimer = setInterval(() => {
        tickCount++
        
        if (tickCount < maxTicks) {
          // Fluctuate randomly
          setSafeToSpend(Math.floor(Math.random() * 20) + 115)
          setMonthlySpent(Math.floor(Math.random() * 100) + 4150)
          setGoalProgress(Math.floor(Math.random() * 8) + 72)
        } else {
          // Settle to final values
          clearInterval(fluctuateTimer)
          setSafeToSpend(127)
          setMonthlySpent(4230)
          setGoalProgress(75)
        }
      }, 400)
    }, 1600)
    
    return () => {
      clearTimeout(startDelay)
      if (fluctuateTimer) clearInterval(fluctuateTimer)
    }
  }, [showDashboard])

  // Loop notifications continuously
  useEffect(() => {
    if (showNotifications) {
      const cycleNotifications = () => {
        setCurrentNotification(-1)
        setVisibleNotifications([])
        
        predictiveNotifications.forEach((_, i) => {
          setTimeout(() => {
            setCurrentNotification(i)
            setVisibleNotifications(prev => [...prev, i])
          }, i * 2000)
        })
        
        // Reset and loop after all notifications shown
        setTimeout(cycleNotifications, predictiveNotifications.length * 2000 + 3000)
      }
      
      cycleNotifications()
    }
  }, [showNotifications])

  useEffect(() => {
    if (isInView && !hasStarted) {
      setHasStarted(true)
      setIsPullingData(true)
      
      // Animate data pulling progress
      let progress = 0
      const progressInterval = setInterval(() => {
        progress += 2
        setDataProgress(progress)
        if (progress >= 100) {
          clearInterval(progressInterval)
          setTimeout(() => setIsPullingData(false), 500)
        }
      }, 50)
      
      let currentIndex = 0
      
      const showNextMessage = () => {
        if (currentIndex < conversation.length) {
          if (conversation[currentIndex].role === "ai") {
            setIsTyping(true)
            setTimeout(() => {
              setIsTyping(false)
              setVisibleMessages(prev => [...prev, currentIndex])
              
              // Show dashboard after the dashboard message
              if (conversation[currentIndex].showDashboard) {
                setTimeout(() => {
                  setShowDashboard(true)
                  // Animate categories one by one
                  spendingCategories.forEach((_, i) => {
                    setTimeout(() => {
                      setAnimatedCategories(prev => [...prev, i])
                    }, i * 150)
                  })
                }, 500)
              }
              
              currentIndex++
              setTimeout(showNextMessage, conversation[currentIndex - 1]?.showDashboard ? 3500 : 1200)
            }, 1800)
          } else {
            setVisibleMessages(prev => [...prev, currentIndex])
            currentIndex++
            setTimeout(showNextMessage, 1000)
          }
        } else {
          // Show notifications after conversation ends, then loop chat
          setTimeout(() => {
            setShowNotifications(true)
          }, 1000)
          
          // Loop chat after a delay
          setTimeout(() => {
            setVisibleMessages([])
            currentIndex = 0
            setTimeout(showNextMessage, 1000)
          }, 8000)
        }
      }
      setTimeout(showNextMessage, 3000) // Start after data pull animation
    }
  }, [isInView, hasStarted])

  return (
    <section id="how-it-works" ref={ref} className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div ref={parallaxRef} className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 pointer-events-none" />
      
      {/* Aurora effects */}
      <div 
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{ transform: `translateY(${offset * 0.2}px)` }}
      >
        <div className="absolute top-1/4 left-0 w-[500px] h-[400px] bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-transparent rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[400px] bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-transparent rounded-full blur-[100px]" />
      </div>
      
      <div className={`max-w-7xl mx-auto relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 text-center text-balance">
          How It Works
        </h2>
        <p className="text-xl text-white/50 text-center mb-8 max-w-2xl mx-auto">
          <span className="font-semibold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Aurora</span> connects to your bank, learns your patterns, and proactively coaches you to make smarter decisions.
        </p>
        
        {/* Security Badge */}
        <div className="flex items-center justify-center gap-6 mb-16 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300 font-medium">Bank-Level 256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300 font-medium">Read-Only Access</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20">
            <Lock className="w-4 h-4 text-teal-400" />
            <span className="text-sm text-teal-300 font-medium">SOC 2 Compliant</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Dashboard Preview */}
          <div className={`transition-all duration-700 ${isPullingData || showDashboard ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <Card className="border border-white/[0.08] shadow-2xl shadow-teal-500/10 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", backdropFilter: "blur(40px)" }}>
              <CardContent className="p-0">
                {/* Data Pulling Header */}
                {isPullingData && (
                  <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center animate-pulse">
                        <Zap className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs text-white/80 font-medium">Connecting to your bank...</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 rounded-full transition-all duration-100"
                        style={{ width: `${dataProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5">Securely pulling transactions... {dataProgress}%</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    <span className="font-semibold text-white text-sm">Your Dashboard</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Live</span>
                  </div>
                </div>
                
                <div className="p-3 space-y-3">
                  {/* Top Widgets Row */}
                  {showDashboard && animatedCategories.length >= 2 && (
                    <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-500">
                      {/* Safe to Spend Widget */}
                      <div className="p-3 rounded-xl border border-emerald-500/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(20,184,166,0.04) 100%)", backdropFilter: "blur(20px)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                            <DollarSign className="w-3 h-3 text-white" />
                          </div>
                          <p className="text-[10px] text-white/50 font-medium">Safe to Spend</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-400 tabular-nums">${safeToSpend}</p>
                        <p className="text-[10px] text-white/40">this week</p>
                      </div>
                      
                      {/* Monthly Spending Widget */}
                      <div className="p-3 rounded-xl border border-cyan-500/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(59,130,246,0.04) 100%)", backdropFilter: "blur(20px)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-3 h-3 text-white" />
                          </div>
                          <p className="text-[10px] text-white/50 font-medium">Spent This Month</p>
                        </div>
                        <p className="text-2xl font-bold text-cyan-400 tabular-nums">${monthlySpent.toLocaleString()}</p>
                        <p className="text-[10px] text-white/40">of $5,000 budget</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Goals Progress Widget */}
                  {showDashboard && animatedCategories.length >= 4 && (
                    <div className="p-3 rounded-xl border border-violet-500/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(168,85,247,0.03) 100%)", backdropFilter: "blur(20px)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center">
                            <Target className="w-3 h-3 text-white" />
                          </div>
                          <p className="text-[10px] text-white/50 font-medium">Your Goals</p>
                        </div>
                        <span className="text-[10px] text-violet-400 font-medium">3 active</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white/80 flex items-center gap-1">Vacation Fund</span>
                            <span className="text-[10px] text-violet-400 font-semibold tabular-nums">{goalProgress}%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${goalProgress}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white/80 flex items-center gap-1">Emergency Fund</span>
                            <span className="text-[10px] text-emerald-400 font-semibold">100%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-white/80 flex items-center gap-1">New Car</span>
                            <span className="text-[10px] text-amber-400 font-semibold">32%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full w-[32%] bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Spending Categories - Compact */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-white/40 font-medium px-1">Spending by Category</p>
                    {spendingCategories.slice(0, 5).map((category, index) => (
                      <div 
                        key={index}
                        className={`transition-all duration-500 ${animatedCategories.includes(index) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{category.emoji}</span>
                            <span className="text-[10px] text-white/80 font-medium">{category.name}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] font-semibold ${category.amount > category.budget ? "text-rose-400" : "text-white"}`}>
                              ${category.amount}
                            </span>
                            <span className="text-[10px] text-white/40"> / ${category.budget}</span>
                          </div>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${category.color} rounded-full transition-all duration-1000 ease-out`}
                            style={{ 
                              width: animatedCategories.includes(index) ? `${Math.min((category.amount / category.budget) * 100, 100)}%` : "0%",
                              transitionDelay: `${index * 100}ms`
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

          {/* Chat Interface */}
          <Card className="border border-white/[0.08] shadow-2xl shadow-teal-500/10 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", backdropFilter: "blur(40px)" }}>
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
                <span className="font-bold text-sm bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Aurora</span>
                <span className="text-xs text-white/40">Your Coach</span>
                <div className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-400">Online</span>
                </div>
              </div>
              
              <div className="p-4 space-y-3 min-h-[420px] max-h-[420px] overflow-y-auto" style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.5) 100%)" }}>
                {conversation.map((message, index) => (
                  visibleMessages.includes(index) && !message.showDashboard && (
                    <div
                      key={index}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-3 duration-500`}
                    >
                      <div
                        className={`max-w-[90%] px-3.5 py-2.5 rounded-[20px] text-xs leading-relaxed ${
                          message.role === "user"
                            ? "rounded-br-lg shadow-lg shadow-teal-500/20 border border-white/[0.15]"
                            : "rounded-bl-lg border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                        }`}
                        style={{
                          background: message.role === "user" 
                            ? "linear-gradient(135deg, rgba(16,185,129,0.7) 0%, rgba(20,184,166,0.6) 50%, rgba(6,182,212,0.5) 100%)"
                            : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
                          backdropFilter: "blur(20px)",
                          color: message.role === "user" ? "white" : "rgba(255,255,255,0.9)"
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  )
                ))}
                {visibleMessages.includes(2) && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3 duration-500">
                    <div 
                      className="max-w-[90%] px-3.5 py-2.5 rounded-[20px] text-xs leading-relaxed rounded-bl-lg border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)", backdropFilter: "blur(20px)", color: "rgba(255,255,255,0.9)" }}
                    >
                      {"Here's your spending breakdown! I've organized everything into categories for you 🎯"}
                      <p className="mt-1.5 text-xs text-teal-400">👈 Check out your dashboard!</p>
                    </div>
                  </div>
                )}
                {isTyping && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div 
                      className="rounded-[20px] rounded-bl-lg border border-white/[0.08] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)", backdropFilter: "blur(20px)" }}
                    >
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-teal-400/80 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-teal-400/80 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-teal-400/80 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/[0.06]" style={{ background: "rgba(15,23,42,0.5)" }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-white/40 text-xs border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <MessageSquare className="w-3 h-3" />
                  Chat with Aurora...
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Phone Notifications Preview */}
          <div className={`transition-all duration-700 ${showNotifications ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="relative">
              {/* Phone Frame */}
              <div className="rounded-[2.5rem] p-2 border border-white/[0.08] shadow-2xl" style={{ background: "linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)" }}>
                <div className="rounded-[2rem] overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,1) 100%)" }}>
                  {/* Phone Notch */}
                  <div className="flex items-center justify-center pt-2 pb-1">
                    <div className="w-20 h-5 bg-black/50 rounded-full" />
                  </div>
                  
                  {/* Status Bar */}
                  <div className="flex items-center justify-between px-6 py-2 text-white/60 text-xs">
                    <span className="font-medium">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-2 bg-white/60 rounded-sm" />
                        <div className="w-1 h-2.5 bg-white/60 rounded-sm" />
                        <div className="w-1 h-3 bg-white/60 rounded-sm" />
                        <div className="w-1 h-3.5 bg-white/40 rounded-sm" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Notifications */}
                  <div className="px-3 pb-4 space-y-2 min-h-[380px]">
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-semibold text-white/80">Predictive Nudges</span>
                      <div className="ml-auto flex items-center gap-1">
                        <Bell className="w-3 h-3 text-white/40" />
                      </div>
                    </div>
                    
                    {predictiveNotifications.map((notif, index) => (
                      <div 
                        key={index}
                        className={`rounded-2xl p-3 border transition-all duration-700 ease-out ${
                          visibleNotifications.includes(index) 
                            ? "opacity-100 translate-y-0 scale-100" 
                            : "opacity-0 -translate-y-4 scale-95"
                        } ${
                          currentNotification === index 
                            ? "border-teal-500/30 shadow-lg shadow-teal-500/20" 
                            : "border-white/[0.08]"
                        }`}
                        style={{ 
                          background: currentNotification === index 
                            ? "linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(255,255,255,0.05) 100%)" 
                            : "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                          backdropFilter: "blur(20px)",
                          transitionDelay: visibleNotifications.includes(index) ? "0ms" : `${index * 100}ms`
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            notif.icon === "brain" ? "bg-gradient-to-br from-violet-400 to-purple-500" :
                            notif.icon === "trophy" ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                            "bg-gradient-to-br from-emerald-400 to-teal-500"
                          } ${currentNotification === index ? "animate-pulse" : ""}`}>
                            {notif.icon === "brain" ? <Brain className="w-4 h-4 text-white" /> :
                             notif.icon === "trophy" ? <Trophy className="w-4 h-4 text-white" /> :
                             <Bell className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-white">{notif.title}</span>
                              <span className={`text-[10px] ${currentNotification === index ? "text-teal-400" : "text-white/40"}`}>{notif.time}</span>
                            </div>
                            <p className="text-[11px] text-white/70 leading-relaxed">{notif.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/15 via-teal-500/15 to-cyan-500/15 rounded-[3rem] blur-3xl -z-10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const { ref, isInView } = useInView(0.2)
  const { ref: parallaxRef, offset } = useParallax(0.1)
  const features = [
    {
      icon: DollarSign,
      title: "Real-Time Financial Decisions",
      description: "Know instantly if you can afford something without breaking your budget.",
      gradient: "from-emerald-400 to-teal-500",
    },
    {
      icon: Target,
      title: "Daily Safe-to-Spend Number",
      description: "Always know your limit. No more guessing or end-of-month surprises.",
      gradient: "from-cyan-400 to-blue-500",
    },
    {
      icon: MessageSquare,
      title: "AI Coaching",
      description: "Personalized guidance based on your behavior, goals, and spending patterns.",
      gradient: "from-violet-400 to-purple-500",
    },
    {
      icon: BarChart3,
      title: "Progress Tracking",
      description: "See yourself move from chaos to growth with clear visual progress.",
      gradient: "from-teal-400 to-emerald-500",
    },
    {
      icon: Brain,
      title: "Predictive Nudges",
      description: "Aurora learns your patterns and sends proactive reminders before you overspend—like a friend who's got your back.",
      gradient: "from-violet-400 to-pink-500",
    },
    {
      icon: Trophy,
      title: "Milestone Rewards",
      description: "Celebrate your wins! Earn real-time rewards and achievements as you hit savings goals and build better habits.",
      gradient: "from-amber-400 to-orange-500",
    },
  ]

  return (
    <section id="features" ref={ref} className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div ref={parallaxRef} className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pointer-events-none" />
      
      {/* Aurora wave effect */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ transform: `translateY(${offset * 0.2}px)` }}
      >
        <div className="absolute top-1/3 left-0 w-full h-48 bg-gradient-to-r from-emerald-500/20 via-teal-500/30 to-cyan-500/20 blur-[100px]" />
      </div>
      
      <div className={`max-w-5xl mx-auto relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 text-center text-balance">
          Everything You Need
        </h2>
        <p className="text-xl text-white/50 text-center mb-16 max-w-2xl mx-auto">
          Powerful features designed to transform how you manage money
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className={`border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] group ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg relative z-10`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 relative z-10">{feature.title}</h3>
                <p className="text-sm text-white/60 relative z-10">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
  const { ref, isInView } = useInView(0.2)
  const { ref: parallaxRef, offset } = useParallax(0.1)
  const testimonials = [
    {
      quote: "This changed how I think about money. I finally understand where every dollar goes.",
      author: "Sarah M.",
      role: "Marketing Manager",
      avatar: "SM",
      gradient: "from-emerald-400 to-teal-500",
    },
    {
      quote: "I finally feel in control. The AI coaching is like having a financial advisor in my pocket.",
      author: "James L.",
      role: "Software Engineer",
      avatar: "JL",
      gradient: "from-cyan-400 to-blue-500",
    },
    {
      quote: "Went from constant overdrafts to actually saving. Aurora made it click for me.",
      author: "Emily R.",
      role: "Freelance Designer",
      avatar: "ER",
      gradient: "from-violet-400 to-purple-500",
    },
    {
      quote: "The safe-to-spend feature alone is worth it. I never have to guess anymore.",
      author: "Michael T.",
      role: "Product Manager",
      avatar: "MT",
      gradient: "from-teal-400 to-cyan-500",
    },
    {
      quote: "Been using it for 3 months. Already saved more than I did all last year combined.",
      author: "Lisa K.",
      role: "Teacher",
      avatar: "LK",
      gradient: "from-blue-400 to-indigo-500",
    },
    {
      quote: "Finally an app that doesn't just track but actually helps. Game changer.",
      author: "David P.",
      role: "Startup Founder",
      avatar: "DP",
      gradient: "from-emerald-400 to-cyan-500",
    },
    {
      quote: "My financial anxiety is finally gone. I know exactly where I stand every day.",
      author: "Rachel W.",
      role: "Healthcare Professional",
      avatar: "RW",
      gradient: "from-teal-400 to-emerald-500",
    },
    {
      quote: "Recommended this to everyone in my family. We're all using it now.",
      author: "Chris H.",
      role: "Small Business Owner",
      avatar: "CH",
      gradient: "from-cyan-400 to-teal-500",
    },
  ]

  return (
    <section ref={ref} className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div ref={parallaxRef} className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 pointer-events-none" />
      
      {/* Aurora glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-transparent rounded-full blur-[150px] pointer-events-none"
        style={{ transform: `translate(-50%, -50%) translateY(${offset * 0.3}px)` }}
      />
      
      <div className={`max-w-6xl mx-auto relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-16 text-center text-balance">
          What{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Early Users</span>{" "}
          Are Saying
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className={`border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-500 hover:scale-[1.02] ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${index * 75}ms` }}
            >
              <CardContent className="p-5">
                <p className="text-white/80 mb-5 leading-relaxed text-sm">{`"${testimonial.quote}"`}</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white font-semibold text-xs shadow-lg`}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{testimonial.author}</p>
                    <p className="text-xs text-white/40">{testimonial.role}</p>
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

function FinalCTASection() {
  const { ref, isInView } = useInView(0.2)
  const scrollProgress = useScrollProgress()

  return (
    <section ref={ref} className="relative py-40 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pointer-events-none" />
      
      {/* Intense aurora effect */}
      <div 
        className="absolute inset-0 opacity-70 pointer-events-none"
        style={{ transform: `translateY(${(1 - scrollProgress) * 50}px)` }}
      >
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[500px] bg-gradient-to-t from-emerald-500/30 via-teal-500/20 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-[500px] h-[400px] bg-gradient-to-t from-cyan-500/25 via-blue-500/15 to-transparent rounded-full blur-[100px]" />
        <div className="absolute bottom-40 left-1/2 w-[400px] h-[350px] bg-gradient-to-t from-violet-500/15 via-purple-500/10 to-transparent rounded-full blur-[100px]" />
      </div>
      
      <div className={`max-w-4xl mx-auto text-center relative z-10 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white mb-8 text-balance">
          Stop Guessing.{" "}
          <span className="block mt-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Start Taking Control.
          </span>
        </h2>
        <p className="text-xl text-white/50 mb-12 max-w-xl mx-auto">
          Join thousands of others who are transforming their relationship with money.
        </p>

        <KitEmailForm />
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-slate-950">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/25">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <span className="font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Aurora</span>
              <p className="text-sm text-white/40">AI Financial Coach</p>
            </div>
          </div>

          <p className="text-sm text-white/40">
            {`© ${new Date().getFullYear()} Aurora. All rights reserved.`}
          </p>
        </div>
        
        {/* Disclaimer */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-xs text-white/30 text-center leading-relaxed max-w-4xl mx-auto">
            This website and any information provided by our AI financial coach are for educational and informational purposes only. We do not provide financial, investment, or legal advice. Any suggestions or insights are not personalized financial advice and should not be relied upon as a substitute for consulting with a qualified professional. You are responsible for your own financial decisions. Past performance or examples do not guarantee future results.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = "smooth"
    return () => {
      document.documentElement.style.scrollBehavior = "auto"
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
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
