import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { computeBudgetStreak } from "@/lib/streaks"

/**
 * GET /api/streaks
 * Returns the user's current Budget Streak — number of consecutive days
 * Spent_d ≤ DailySTS_d, plus today's at-risk status.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const result = await computeBudgetStreak(userId)
    return NextResponse.json(result)
  } catch (e) {
    console.error("computeBudgetStreak failed:", e)
    return NextResponse.json({
      streak: 0,
      longest: 0,
      brokenToday: false,
      todaySpent: 0,
      todayLimit: 0,
      lastVerifiedDate: null,
      daysChecked: 0,
      source: "none",
    })
  }
}
