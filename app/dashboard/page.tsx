import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { getSupabase } from "@/lib/supabase"
import { requireApproved } from "@/lib/access-control"
import { ThemeToggle } from "@/components/theme-toggle"
import { PageTransition } from "@/components/page-transition"
import { StarryBackground } from "@/components/starry-background"
import { DashboardContent } from "./dashboard-content"

export default async function DashboardPage() {
  const user = await requireApproved()

  // Fetch profile to check bank_linked status
  let profile: Record<string, unknown> | null = null
  const { data, error } = await getSupabase()
    .from("user_profiles")
    .select("bank_linked, goal_description, goal_amount, goal_deadline, goal_saved, goal_status, safety_buffer, points, points_streak, longest_streak")
    .eq("clerk_user_id", user?.id ?? "")
    .single()

  if (!error) {
    profile = data
  } else {
    // Fallback without newer columns if they don't exist yet
    const { data: fallback } = await getSupabase()
      .from("user_profiles")
      .select("bank_linked, goal_description, goal_amount, goal_deadline, goal_saved, safety_buffer")
      .eq("clerk_user_id", user?.id ?? "")
      .single()
    profile = fallback
  }

  const bankLinked = (profile?.bank_linked as boolean) ?? false

  // Check if user has vault uploads (for metrics without bank)
  const { data: vaultCheck } = await getSupabase()
    .from("vault_uploads")
    .select("id")
    .eq("clerk_user_id", user?.id ?? "")
    .limit(1)
    .single()
  const hasVaultData = !!vaultCheck

  return (
    <div className="min-h-screen relative">
      <StarryBackground />
      {/* Header */}
      <header className="relative z-10 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-aurora-emerald via-aurora-teal to-aurora-violet rounded-xl flex items-center justify-center shadow-lg shadow-aurora-teal/25">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-aurora-emerald via-aurora-teal to-aurora-violet bg-clip-text text-transparent">
              Aurora
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.firstName ? `Hey, ${user.firstName}` : "Welcome"}
            </span>
            <ThemeToggle />
            <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTransition>
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
              <p className="text-muted-foreground">Here&apos;s how your finances are looking today.</p>
            </div>
            <Link
              href="/dashboard/vault"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-card/60 hover:text-foreground transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              Data Vault
            </Link>
          </div>

          <DashboardContent
          bankLinked={bankLinked}
          hasVaultData={hasVaultData}
          goalDescription={profile?.goal_description as string | undefined}
          goalAmount={profile?.goal_amount as number | undefined}
          goalDeadline={profile?.goal_deadline as string | undefined}
          goalSaved={profile?.goal_saved as number | undefined}
          goalStatus={profile?.goal_status as string | undefined}
          safetyBuffer={profile?.safety_buffer as number | undefined}
          points={profile?.points as number | undefined}
          pointsStreak={profile?.points_streak as number | undefined}
          longestStreak={profile?.longest_streak as number | undefined}
          />
        </PageTransition>
      </main>
    </div>
  )
}
