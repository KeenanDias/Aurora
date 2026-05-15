import { redirect } from "next/navigation"
import { currentUser } from "@clerk/nextjs/server"
import { getSupabase } from "@/lib/supabase"
import { StarryBackground } from "@/components/starry-background"
import { OnboardingChat } from "@/components/onboarding-chat"

/**
 * Full-screen scripted KYC onboarding. Server component:
 *   - signed-out → /sign-in
 *   - already onboarded → /dashboard
 *   - otherwise renders the client chat
 *
 * Beta access gate is intentionally NOT applied here so a freshly approved
 * user can land on this page right after sign-in. The dashboard guard runs
 * its own access check.
 */
export default async function OnboardingPage() {
  const user = await currentUser()
  if (!user) redirect("/sign-in")

  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("onboarded")
    .eq("clerk_user_id", user.id)
    .maybeSingle()

  if (profile?.onboarded === true) redirect("/dashboard")

  return (
    <div className="min-h-screen relative">
      <StarryBackground />
      <OnboardingChat userId={user.id} />
    </div>
  )
}
