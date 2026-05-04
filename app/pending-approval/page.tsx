import Link from "next/link"
import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import { UserButton } from "@clerk/nextjs"
import { getSupabase } from "@/lib/supabase"
import { Clock, Mail } from "lucide-react"
import { StarryBackground } from "@/components/starry-background"

export default async function PendingApprovalPage() {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const email = user.emailAddresses[0]?.emailAddress.toLowerCase()

  // Re-check approval — if they were approved while sitting on this page, send them onward
  if (email) {
    const { data: req } = await getSupabase()
      .from("access_requests")
      .select("status")
      .eq("email", email)
      .single()

    if (req?.status === "approved") {
      // Sync their profile and forward
      await getSupabase()
        .from("user_profiles")
        .update({ access_status: "approved", updated_at: new Date().toISOString() })
        .eq("clerk_user_id", user.id)
      redirect("/dashboard")
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      <StarryBackground />
      <header className="relative z-10 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
              Aurora
            </span>
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">You&apos;re on the list</h1>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Aurora is currently in closed beta. Our team will review your request and email you
              shortly with access. Thanks for your patience!
            </p>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6 text-left">
              <p className="text-xs text-white/40 mb-1 flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                We&apos;ll reach out to
              </p>
              <p className="text-sm text-white/80 font-medium">{email}</p>
            </div>

            <p className="text-xs text-white/30">
              Have questions? Reply to our welcome email or contact the team directly.
            </p>
          </div>

          <p className="text-center mt-6 text-xs text-white/30">
            Already approved?{" "}
            <Link href="/dashboard" className="text-emerald-400 hover:underline">
              Refresh your status
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
