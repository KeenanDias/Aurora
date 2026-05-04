import { redirect } from "next/navigation"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { getSupabase } from "@/lib/supabase"
import { isAdmin } from "@/lib/admin"
import { StarryBackground } from "@/components/starry-background"
import { AdminContent } from "./admin-content"

export type AccessRequest = {
  id: string
  email: string
  name: string
  status: "pending" | "approved" | "denied"
  source: string | null
  notes: string | null
  requested_at: string
  decided_at: string | null
  decided_by: string | null
  notified_at: string | null
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect("/dashboard")
  }

  const { data } = await getSupabase()
    .from("access_requests")
    .select("*")
    .order("requested_at", { ascending: false })

  const requests = (data ?? []) as AccessRequest[]

  return (
    <div className="min-h-screen relative">
      <StarryBackground />
      <header className="relative z-10 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
              Aurora Admin
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-white/50 hover:text-white/80 transition-colors">
              ← Back to dashboard
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Beta Access Requests</h1>
          <p className="text-white/40">Approve or deny early access requests. Approved users receive an email automatically.</p>
        </div>

        <AdminContent initialRequests={requests} />
      </main>
    </div>
  )
}
