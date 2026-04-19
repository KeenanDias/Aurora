import { UserButton } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { DashboardContent } from "./dashboard-content"

export default async function DashboardPage() {
  const user = await currentUser()

  // Fetch profile to check bank_linked status
  let profile: Record<string, unknown> | null = null
  const { data, error } = await getSupabase()
    .from("user_profiles")
    .select("bank_linked, goal_description, goal_amount, goal_deadline, goal_saved, safety_buffer")
    .eq("clerk_user_id", user?.id ?? "")
    .single()

  if (!error) {
    profile = data
  } else {
    // Fallback without goal_saved if column doesn't exist yet
    const { data: fallback } = await getSupabase()
      .from("user_profiles")
      .select("bank_linked, goal_description, goal_amount, goal_deadline, safety_buffer")
      .eq("clerk_user_id", user?.id ?? "")
      .single()
    profile = fallback
  }

  const bankLinked = (profile?.bank_linked as boolean) ?? false

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

        <DashboardContent
          bankLinked={bankLinked}
          goalDescription={profile?.goal_description as string | undefined}
          goalAmount={profile?.goal_amount as number | undefined}
          goalDeadline={profile?.goal_deadline as string | undefined}
          goalSaved={profile?.goal_saved as number | undefined}
          safetyBuffer={profile?.safety_buffer as number | undefined}
        />
      </main>
    </div>
  )
}
