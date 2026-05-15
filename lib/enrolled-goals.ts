import { getSupabase } from "@/lib/supabase"
import type { EnrolledGoal } from "@/lib/safe-to-spend"

/**
 * Fetch the user's enrolled goals (is_enrolled=true, status='active') for
 * Safe-to-Spend math. Falls back to an empty list — calculateSafeToSpend
 * will then use the legacy single-goal params from user_profiles.
 *
 * Errors are swallowed (returns []) so a missing migration or schema-cache
 * lag never breaks the dashboard's STS render.
 */
export async function fetchActiveGoals(userId: string): Promise<EnrolledGoal[]> {
  try {
    const { data, error } = await getSupabase()
      .from("goals")
      .select("id, description, amount, saved, deadline, status, is_enrolled")
      .eq("clerk_user_id", userId)
      .eq("is_enrolled", true)
      .eq("status", "active")
    if (error) {
      // Likely the column hasn't been migrated yet — fall back gracefully.
      if (error.message?.toLowerCase().includes("is_enrolled")) return []
      console.warn("fetchActiveGoals error:", error.message)
      return []
    }
    return (data ?? []).map((g) => ({
      id: g.id as string,
      description: g.description as string,
      amount: Number(g.amount),
      saved: Number(g.saved ?? 0),
      deadline: (g.deadline as string | null) ?? null,
    }))
  } catch (e) {
    console.warn("fetchActiveGoals threw:", e)
    return []
  }
}
