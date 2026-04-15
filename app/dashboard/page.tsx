import { UserButton } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import { DollarSign, BarChart3, Target, MessageSquare, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const user = await currentUser()

  return (
    <div className="min-h-screen bg-[#0b1120] relative overflow-hidden">
      {/* Subtle aurora background */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-transparent rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06] bg-[#0b1120]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
              Aurora
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/50">
              {user?.firstName ? `Hey, ${user.firstName}` : "Welcome"}
            </span>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Dashboard</h1>
          <p className="text-white/40">Here&apos;s how your finances are looking today.</p>
        </div>

        {/* Placeholder cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: DollarSign, label: "Safe to Spend", value: "—", color: "emerald", desc: "Connect bank to see" },
            { icon: BarChart3, label: "Monthly Spending", value: "—", color: "cyan", desc: "No data yet" },
            { icon: Target, label: "Goals", value: "0", color: "violet", desc: "Set your first goal" },
            { icon: MessageSquare, label: "Nudges Today", value: "0", color: "teal", desc: "Coming soon" },
          ].map((card) => (
            <div
              key={card.label}
              className={`p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 bg-gradient-to-br from-${card.color}-400 to-${card.color}-600 rounded-lg flex items-center justify-center`}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-white/40 font-medium">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
              <p className="text-xs text-white/30">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Getting started card */}
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-teal-500/[0.03] to-violet-500/[0.04] p-8">
          <h2 className="text-xl font-bold text-white mb-2">Get Started with Aurora</h2>
          <p className="text-white/40 mb-6 max-w-lg">
            Connect your bank account to unlock personalized AI coaching, safe-to-spend tracking, and predictive nudges.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-teal-500/20 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 transition-all">
              Connect Your Bank
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-white/60 font-medium text-sm hover:bg-white/[0.04] transition-all">
              Take a Tour
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
