import { UserButton } from "@clerk/nextjs"
import { currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { PageTransition } from "@/components/page-transition"
import { StarryBackground } from "@/components/starry-background"
import { VaultContent } from "./vault-content"

export default async function VaultPage() {
  const user = await currentUser()

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
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Data Vault</h1>
            <p className="text-muted-foreground">
              Your encrypted bank data — Plaid connections and manual statement uploads.
            </p>
          </div>

          <VaultContent />
        </PageTransition>
      </main>
    </div>
  )
}
