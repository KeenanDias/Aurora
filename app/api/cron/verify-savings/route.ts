import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { verifySavingsClaim, VERIFY_SAVINGS_CONSTANTS } from "@/lib/verify-savings"

/**
 * Re-checks 'pending' and 'probable' goal_contributions and either upgrades
 * them to 'verified' (Karma awarded) or flips them to 'unverified' after
 * the 48-hour grace window.
 *
 * Auth: requires the CRON_SECRET bearer token. Hook this into Vercel Cron
 * (or any external scheduler) at an hourly cadence.
 *
 * The same logic can be triggered manually post-sync to retry a stuck
 * pending row — just call this endpoint after any Plaid sync.
 */

const KARMA_PER_VERIFIED_SAVE = 10

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date()

  // Pull every still-uncertain contribution
  const { data: rows, error } = await supabase
    .from("goal_contributions")
    .select("id, clerk_user_id, goal_id, amount, claimed_at, verification_status, karma_awarded, balance_at_claim")
    .in("verification_status", ["pending", "probable"])
    .order("claimed_at", { ascending: true })

  if (error) {
    console.error("verify-savings cron fetch error:", error)
    return NextResponse.json({ error: "fetch failed" }, { status: 500 })
  }

  const stats = { processed: 0, verified: 0, unverified: 0, stillPending: 0, karmaAwarded: 0 }

  for (const row of rows ?? []) {
    stats.processed++
    const claimedAt = new Date(row.claimed_at as string)
    const ageMs = now.getTime() - claimedAt.getTime()

    // Pull the prior snapshot for this user (the one BEFORE this row)
    const { data: priorRow } = await supabase
      .from("goal_contributions")
      .select("balance_at_claim")
      .eq("clerk_user_id", row.clerk_user_id)
      .lt("claimed_at", row.claimed_at as string)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const previousBalanceSnapshot = priorRow?.balance_at_claim != null
      ? Number(priorRow.balance_at_claim)
      : null

    const result = await verifySavingsClaim({
      userId: row.clerk_user_id as string,
      contributionId: row.id as string,
      claimedAmount: Number(row.amount),
      claimedAt,
      previousBalanceSnapshot,
    })

    // Decide the final status. After the grace window with no verify, lock
    // pending/probable → unverified. Probable rows that haven't matured can
    // stay 'probable' until they either verify or age out.
    let finalStatus = result.status
    if (
      finalStatus === "pending" &&
      ageMs > VERIFY_SAVINGS_CONSTANTS.PENDING_GRACE_MS
    ) {
      finalStatus = "unverified"
    }
    if (
      finalStatus === "probable" &&
      ageMs > VERIFY_SAVINGS_CONSTANTS.PENDING_GRACE_MS * 2
    ) {
      // Held for 96h as probable without a confirmed transfer — give up.
      finalStatus = "unverified"
    }

    await supabase
      .from("goal_contributions")
      .update({
        verification_status: finalStatus,
        verification_method: result.method,
        observed_growth: result.observedGrowth,
        balance_at_claim: result.balanceSnapshot ?? row.balance_at_claim,
        matched_transfer_id: result.matchedTransferId,
        verified_at:
          finalStatus === "verified" || finalStatus === "probable"
            ? now.toISOString()
            : null,
        updated_at: now.toISOString(),
      })
      .eq("id", row.id as string)

    if (finalStatus === "verified") stats.verified++
    else if (finalStatus === "unverified") stats.unverified++
    else stats.stillPending++

    // Award Karma once per verified contribution.
    if (finalStatus === "verified" && !row.karma_awarded) {
      const dedupKey = `goal_contribution:${row.id}`
      const { data: existing } = await supabase
        .from("points_ledger")
        .select("id")
        .eq("description", dedupKey)
        .maybeSingle()
      if (!existing) {
        await supabase.from("points_ledger").insert({
          clerk_user_id: row.clerk_user_id as string,
          action: "verified_save",
          points: KARMA_PER_VERIFIED_SAVE,
          description: dedupKey,
        })
        await supabase
          .from("goal_contributions")
          .update({ karma_awarded: true })
          .eq("id", row.id as string)

        const { data: prof } = await supabase
          .from("user_profiles")
          .select("points")
          .eq("clerk_user_id", row.clerk_user_id as string)
          .maybeSingle()
        await supabase
          .from("user_profiles")
          .update({
            points: Number(prof?.points ?? 0) + KARMA_PER_VERIFIED_SAVE,
            updated_at: now.toISOString(),
          })
          .eq("clerk_user_id", row.clerk_user_id as string)
        stats.karmaAwarded++
      }
    }
  }

  return NextResponse.json({ success: true, stats })
}

// GET handler for testing — same auth, same logic.
export const GET = POST
