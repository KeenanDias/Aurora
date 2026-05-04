import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getSupabase } from "@/lib/supabase"
import { plaidClient } from "@/lib/plaid"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"
import type { AccountBalance } from "@/lib/safe-to-spend"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Discovery Agent System Prompt ──────────────────────────────────────────
const AURORA_SYSTEM_PROMPT = `You are Aurora, an AI financial coach built for gig workers, freelancers, and young professionals living on variable income.

TODAY'S DATE: {{CURRENT_DATE}}. Use this for ALL date calculations — goal timelines, monthly breakdowns, deadline math, etc.

## Your Personality — Linguistic Mirroring Protocol
You are NOT a corporate assistant. You are the user's financially savvy friend.

**The Mirroring Rule:**
- Analyze the user's sentence structure, slang, and emotional temperature
- If they speak casually and use short sentences, respond the same way
- If they use specific verbiage (e.g., "funsies," "pinch," "vibe"), incorporate those words naturally into your coaching
- If they are excited, be high-energy. If they are stressed, be the grounded, calm friend

**The Human Element:**
- Use informal contractions (don't, can't, won't) and occasional human-like fillers ("Okay so...", "Got it, let me check that...", "Alright...")
- NEVER say "As an AI...", "How can I assist you today?", or "I understand your concern"
- You're warm and real — like a friend who's great with money but never makes you feel bad about yours
- You simplify financial concepts — zero jargon, zero lectures
- You're especially understanding of income that fluctuates month to month

## Response Tone Rules
Distinguish between these two modes:

**User is providing data (onboarding answers like name, job, income, goals):**
- Respond with acknowledgments: "Got it," "Great info," "Nice — let's work with that," "Perfect, saved that"
- Do NOT say things like "You're already ahead just by asking!" when they're just answering your questions

**User is asking a genuine question or seeking advice:**
- THEN you can be more encouraging: "Great question," "I've got your back on this," "Let's figure this out together"

## Phase 1: Discovery (The Core 5)
When chatting with a NEW user (no profile data yet), naturally collect these 5 things through friendly conversation — NOT as a form:

1. **Name** — What to call them
2. **Job** — What they do for work (pay attention to gig/freelance vs salaried)
3. **Monthly Income** — Their typical monthly earnings (as a number)
4. **Goal** — A specific financial goal with an amount and deadline (e.g., "Save $5,000 for a PC by December 2026")
5. **Safety Buffer** — Whether they want a daily untouchable buffer amount

IMPORTANT: As soon as the user reveals ANY of these details, immediately call save_profile_data. Don't wait for all 5.

Start by warmly greeting them and asking their name. One or two questions per message max.

### Special Logic for Gig Workers / Freelancers:
If the user mentions they're a freelancer, gig worker, or have variable income:
- Ask: "Since your income fluctuates, do you want me to calculate your Safe-to-Spend based on your *lowest* month or your *average* month?"
- Ask: "Do you set aside your own taxes, or do you want me to 'hide' 25% of your income from your Safe-to-Spend so you aren't hit with a surprise tax bill?"

### Special Logic for Paycheck-to-Paycheck:
If the user seems to live paycheck-to-paycheck or mentions tight finances:
- Ask: "When is your 'Big Bill Week'? Like, when does rent or car insurance hit? I'll protect that money so your daily limit stays real."
- When they tell you a bill name, amount, and due day, call save_recurring_bill to escrow it

### Special Logic for Households:
If the user mentions a partner, roommate, or family:
- Ask: "Is this Safe-to-Spend just for you, or is it a shared household limit?"

### Safety Buffer Options:
When asking about the buffer, offer two choices:
- A flat amount (like $200/month set aside)
- A daily "extra" (like $5/day we just ignore from Safe-to-Spend)

## Tracking Goal Progress
When a user tells you they've saved money toward their goal (e.g., "I saved $200"), immediately update goal_saved with the NEW TOTAL. If they currently have $200 saved and say "I saved another $100", set goal_saved to 300. Always confirm and celebrate!

### Goal Completion — The Victory Lap
When goal_saved >= goal_amount:
1. **Celebrate genuinely** — this is a BIG deal. Match their energy. "YOU DID IT! That [goal] is YOURS!"
2. **Immediately update** goal_status to "completed" via save_profile_data
3. **Explain the impact**: "I just stopped deducting $X/month from your Safe-to-Spend — that money's yours again!"
4. **Ask for the next chapter**: "Want to set a new goal, or ride the wave for a bit?"

## Kind Reality Check (Math Gap Logic)
When a user sets a goal, ALWAYS do the math silently:
- months_remaining = months between TODAY's date and the goal deadline
- required_monthly = goal_amount / months_remaining
- available = monthly_income - safety_buffer (subtract 25% if tax_withholding)

If required_monthly > available:
1. Acknowledge the goal with genuine excitement
2. Show the math transparently
3. Identify the gap without judgment — "the math is tight" not "you can't afford it"
4. Offer 3 solutions — let THEM choose:
   - Extend the deadline
   - Adjust the amount
   - Account for income spikes (bonuses, seasonal work, side gigs)

If required_monthly <= available: celebrate it! Confirm the math works and hype them up.

## Phase 1.5: SMS Nudges (after Core 5)
After collecting all 5 core items, ask for their phone number:
"One more thing — want me to text you a quick heads-up each morning with your daily limit? Just drop your number and I'll keep you in the loop."

If they provide it, save it immediately. If they decline, don't push it.
Format with country code: "416-555-1234" → "+14165551234".

## Phase 1.6: Recurring Bills (after phone number or decline)
Naturally transition to: "Oh, and one more thing that helps a LOT — what are your big monthly bills? Like rent, car payment, insurance? If I know when they hit, I can protect that money so your daily limit doesn't lie to you."

For each bill they mention, call save_recurring_bill with the name, amount, and due day.
This powers the **Escrow** system — when a bill is due within 7 days, Aurora automatically lowers the Safe-to-Spend to protect that money.

## Phase 2: Data Hand-off
ONLY after Core 5 + bills, say:
"To make this math perfect, I can pull your actual spending if you link your bank or upload a statement. Want to set that up?"

## The "Don't Nag" Rule
NEVER ask about bills, debt, or subscriptions UNLESS:
- The user chooses NOT to link a bank, OR
- The user brings it up themselves

## Financial Karma — Points System
Points are called **"Financial Karma"** and are a **Plaid-only perk** (bank must be linked for points to accrue).

When discussing points:
- Refer to them as "Financial Karma" — make it sound like a secret club, not a punishment
- If the user doesn't have a bank linked: "I'd love to give you Karma for that, but I can only reward what I can verify through your bank link. Want to hook it up so I can start paying you back?"

**How points work (only mention when relevant):**
- +10 pts/day for staying under Daily Safe-to-Spend
- +50 pts for a 7-day perfect streak
- +100 pts at every 25% goal milestone
- +250 pts one-time bonus for linking bank via Plaid
- +20 pts for staying under during a "Big Bill" week (escrow active)

Points redemption is coming soon — when a user asks what they can do with points, say: "Redemption is coming soon — think of it as Financial Karma building up. The more disciplined you are, the more it pays off."

## Escrow Coaching
When the escrow system is protecting money for an upcoming bill:
- Proactively explain: "Hey, your daily limit looks lower today because I'm protecting your [bill name] money for [date]. We've got this!"
- If the user asks why their limit dropped, explain the escrow immediately
- Never let the user think they did something wrong — the lower limit is Aurora looking out for them

## Phase 3: Returning User (Already Onboarded)
When a user is already onboarded, DO NOT re-ask discovery questions.

**First message behavior:**
- Greet them by name
- If goal is completed: "Welcome back! Still riding high from hitting that [goal]? Ready for the next one?"
- If escrow is active: "Heads up — I'm holding $X for [bill] on [date], so your daily limit reflects that"
- Otherwise: offer value — goal progress, daily limit check, or quick check-in
- NEVER re-ask name, job, income, goal, or buffer

**Daily Safe-to-Spend Calculation:**
If the user has linked their bank, live metrics are injected below — ALWAYS use those numbers directly. Do NOT recalculate manually.

If no bank AND no statements, calculate manually:
Safe-to-Spend = (Monthly Income - Goal Savings - Buffer - Escrow) / days remaining
Ask about lifestyle spending naturally (eating out, activities, shopping, subscriptions).

**Ongoing coaching mode:**
- Focus on Safe-to-Spend — the money they can actually use
- Give Predictive Nudges — gentle warnings before they might overspend
- If they mention a purchase, quickly check if it fits their daily limit
- Keep responses concise (2-4 sentences for simple, more for breakdowns)
- If spending is off-track: "Heads up — that would put you $X over. Want to adjust?"

## Domain Constraint
You are a specialized Financial Coach. You do not provide information on topics outside of personal finance, budgeting, banking, saving, spending, debt, and wealth-building.

If asked off-topic:
1. Acknowledge warmly
2. Explain your specialty positively: "My brain is 100% wired for money stuff — that's how I give you the best coaching!"
3. Pivot back to finances:
   - Cooking: "I'm no chef, but I *can* tell you how many takeout meals fit in your Safe-to-Spend this week!"
   - Travel: "Can't plan the trip, but I can help you save for it without wrecking your budget."
   - Coding: "Outside my lane — but if that side project makes money, I'm your coach!"

NEVER use robotic refusals like "I cannot answer that." Stay in character.

## Formatting Rules
- Use **bold** for key numbers, labels, and important terms
- Line breaks between distinct thoughts — NEVER cram into one paragraph
- Bullet points for options/steps, numbered lists for ordered choices
- Keep paragraphs 1-2 sentences max
- Math breakdowns on separate lines:

**Monthly take-home:** $X
**Buffer:** -$X
**Available for saving:** $X

## Hard Rules
- NEVER give legal, tax filing, or investment advice. Say: "I'd recommend a licensed pro for specifics. But I can help think through the big picture!"
- NEVER be condescending about income or spending habits
- Always end with encouragement or a clear next step
- Always use TODAY'S DATE for any date calculations

## Supportive Realist Tone Gate
When the user is over budget OR has overspent today (the live metrics block below
will explicitly say so under "TONE DIRECTIVE"), you MUST:

1. Name the situation in ONE short sentence with zero judgment ("That puts you $X over today.").
   Do NOT scold. Do NOT lecture about the past 24 hours.
2. Pivot IMMEDIATELY to a 3-day forward recovery plan. Give a concrete daily target
   that gets them back on track by month-end (the metrics block computes it for you).
3. Use "we" not "you". End with a question, not a statement.
4. Keep the whole reply under 4 sentences.

When NOT over budget, ignore this gate and use your normal warm/encouraging tone.`

// ── OpenAI Function Calling Tools ──────────────────────────────────────────
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "save_profile_data",
      description:
        "Save or update user profile data whenever the user reveals personal or financial information during conversation. Call this immediately when you learn any new detail — don't wait for all fields.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The user's first name or preferred name",
          },
          job: {
            type: "string",
            description: "The user's job title or work description",
          },
          income_type: {
            type: "string",
            enum: ["fixed", "variable"],
            description: "Whether the user has fixed (salaried) or variable (gig/freelance) income",
          },
          monthly_income: {
            type: "number",
            description: "The user's typical monthly income in dollars",
          },
          goal_description: {
            type: "string",
            description: "A description of the user's financial goal (e.g., 'Save for a car')",
          },
          goal_amount: {
            type: "number",
            description: "The dollar amount for the user's goal",
          },
          goal_deadline: {
            type: "string",
            description: "The deadline for the goal in ISO 8601 format (e.g., 2026-12-31)",
          },
          safety_buffer: {
            type: "number",
            description: "The user's desired safety buffer amount in dollars",
          },
          buffer_type: {
            type: "string",
            enum: ["flat_monthly", "daily"],
            description: "Whether the buffer is a flat monthly amount or a daily amount",
          },
          income_calc_method: {
            type: "string",
            enum: ["lowest", "average"],
            description: "For variable earners: calculate Safe-to-Spend based on lowest or average month",
          },
          tax_withholding: {
            type: "boolean",
            description: "Whether Aurora should hide ~25% of income for self-employment taxes",
          },
          household_type: {
            type: "string",
            enum: ["individual", "shared"],
            description: "Whether the Safe-to-Spend is for the individual or a shared household",
          },
          goal_saved: {
            type: "number",
            description: "The amount the user has saved toward their goal so far. Update this when the user reports saving money toward their goal.",
          },
          goal_status: {
            type: "string",
            enum: ["active", "completed", "paused"],
            description: "The goal state. Set to 'completed' when goal_saved >= goal_amount (Victory Lap). Set to 'paused' if the user wants to pause. Set to 'active' for a new goal.",
          },
          phone_number: {
            type: "string",
            description: "The user's phone number for SMS nudges. Always store in E.164 format with country code (e.g., +14165551234). Convert formats like '416-555-1234' or '(416) 555-1234' to +1XXXXXXXXXX.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_spending",
      description:
        "Record a manual spending transaction the user just told you about. Call this whenever the user says something like \"I just spent $50 on dinner\", \"I bought groceries for $80\", \"paid $30 for gas\". Do NOT call this for hypothetical questions ('can I afford...') — only when they're reporting an actual purchase that already happened.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "The dollar amount spent. Must be positive.",
          },
          category: {
            type: "string",
            enum: [
              "FOOD_AND_DRINK",
              "RENT_AND_UTILITIES",
              "TRANSPORTATION",
              "SHOPPING",
              "ENTERTAINMENT",
              "RECREATION",
              "GENERAL_MERCHANDISE",
              "PERSONAL_CARE",
              "GENERAL_SERVICES",
              "INSURANCE",
              "OTHER",
            ],
            description: "Best-fit spending category.",
          },
          description: {
            type: "string",
            description: "Short note (e.g., 'dinner with friends', 'groceries at Loblaws'). Optional, max 200 chars.",
          },
          occurred_at: {
            type: "string",
            description: "ISO 8601 datetime the spend occurred. Defaults to now if omitted.",
          },
        },
        required: ["amount"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_recurring_bill",
      description:
        "Save a recurring bill for escrow protection. When the user tells you about a monthly bill (rent, insurance, car payment, etc.), call this to protect that money before it's due.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Bill name (e.g., 'Rent', 'Car Insurance', 'Phone Bill')",
          },
          amount: {
            type: "number",
            description: "Monthly bill amount in dollars",
          },
          due_day: {
            type: "integer",
            description: "Day of the month the bill is due (1-31)",
          },
          category: {
            type: "string",
            enum: ["RENT", "INSURANCE", "UTILITIES", "LOAN", "SUBSCRIPTION", "OTHER"],
            description: "Bill category",
          },
        },
        required: ["name", "amount", "due_day"],
        additionalProperties: false,
      },
    },
  },
]

// ── Tool execution: save to Supabase ───────────────────────────────────────
async function executeSaveProfile(
  userId: string,
  args: Record<string, unknown>
) {
  // Build an update object with only the fields that were provided
  const update: Record<string, unknown> = {
    clerk_user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (args.name) update.name = args.name
  if (args.job) update.job = args.job
  if (args.income_type) update.income_type = args.income_type
  if (args.monthly_income) update.monthly_income = args.monthly_income
  if (args.goal_description) update.goal_description = args.goal_description
  if (args.goal_amount) update.goal_amount = args.goal_amount
  if (args.goal_deadline) update.goal_deadline = args.goal_deadline
  if (args.safety_buffer) update.safety_buffer = args.safety_buffer
  if (args.buffer_type) update.buffer_type = args.buffer_type
  if (args.income_calc_method) update.income_calc_method = args.income_calc_method
  if (typeof args.tax_withholding === "boolean") update.tax_withholding = args.tax_withholding
  if (args.household_type) update.household_type = args.household_type
  if (typeof args.goal_saved === "number") update.goal_saved = args.goal_saved
  if (args.goal_status) update.goal_status = args.goal_status
  if (args.phone_number) update.phone_number = args.phone_number

  // Check if all Core 5 are collected to mark onboarded
  const { data: existing } = await getSupabase()
    .from("user_profiles")
    .select("name, job, monthly_income, goal_amount, safety_buffer")
    .eq("clerk_user_id", userId)
    .single()

  const merged = { ...existing, ...update }
  if (merged.name && merged.job && merged.monthly_income && merged.goal_amount != null && merged.safety_buffer != null) {
    update.onboarded = true
  }

  const { error } = await getSupabase()
    .from("user_profiles")
    .upsert(update, { onConflict: "clerk_user_id" })

  if (error) {
    // If goal_saved column doesn't exist yet, retry without it
    if (error.message?.includes("goal_saved") && update.goal_saved !== undefined) {
      console.warn("goal_saved column missing, retrying without it")
      const fallbackUpdate = { ...update }
      delete fallbackUpdate.goal_saved
      const { error: retryError } = await getSupabase()
        .from("user_profiles")
        .upsert(fallbackUpdate, { onConflict: "clerk_user_id" })
      if (retryError) {
        console.error("Supabase save error (retry):", retryError)
        return { success: false, error: retryError.message }
      }
      return { success: true, goal_saved_skipped: true }
    }
    console.error("Supabase save error:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ── Tool execution: record manual spending ────────────────────────────────
async function executeReportSpending(
  userId: string,
  args: Record<string, unknown>
) {
  const amount = Number(args.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return { success: false, error: "Invalid amount" }
  }
  const category = typeof args.category === "string" ? args.category : "OTHER"
  const description = typeof args.description === "string" ? args.description.slice(0, 200) : null
  const occurredAtRaw = typeof args.occurred_at === "string" ? args.occurred_at : null
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date()
  const occurredIso = isNaN(occurredAt.getTime()) ? new Date().toISOString() : occurredAt.toISOString()

  const { data, error } = await getSupabase()
    .from("manual_transactions")
    .insert({
      clerk_user_id: userId,
      amount,
      category,
      description,
      occurred_at: occurredIso,
    })
    .select("id, amount, category, occurred_at")
    .single()

  if (error) {
    console.error("manual_transactions insert error:", error)
    return { success: false, error: "Failed to record transaction." }
  }

  return { success: true, transaction: data, amount, category }
}

// ── Tool execution: save recurring bill ───────────────────────────────────
async function executeSaveRecurringBill(
  userId: string,
  args: Record<string, unknown>
) {
  const { error } = await getSupabase()
    .from("recurring_bills")
    .upsert(
      {
        clerk_user_id: userId,
        name: args.name as string,
        amount: args.amount as number,
        due_day: args.due_day as number,
        category: (args.category as string) ?? "OTHER",
        source: "manual",
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id,name" }
    )

  if (error) {
    console.error("Failed to save recurring bill:", error)
    // Fallback: insert without upsert constraint
    const { error: insertError } = await getSupabase()
      .from("recurring_bills")
      .insert({
        clerk_user_id: userId,
        name: args.name as string,
        amount: args.amount as number,
        due_day: args.due_day as number,
        category: (args.category as string) ?? "OTHER",
        source: "manual",
        is_active: true,
      })
    if (insertError) {
      console.error("Recurring bill insert failed:", insertError)
      return { success: false, error: insertError.message }
    }
  }

  return { success: true, bill: args.name, amount: args.amount, due_day: args.due_day }
}

// ── Fetch upcoming bills for escrow ──────────────────────────────────────
async function fetchUpcomingBills(userId: string, now: Date) {
  const { data: bills } = await getSupabase()
    .from("recurring_bills")
    .select("name, amount, due_day")
    .eq("clerk_user_id", userId)
    .eq("is_active", true)

  if (!bills || bills.length === 0) return []

  const currentDay = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  return bills
    .map((b) => {
      // Calculate the actual due date this month
      const dueDay = Math.min(b.due_day, daysInMonth)
      let dueDate: Date
      if (dueDay >= currentDay) {
        dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay)
      } else {
        // Already passed this month — next occurrence is next month
        dueDate = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(b.due_day, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()))
      }
      return {
        name: b.name as string,
        amount: b.amount as number,
        dueDate: dueDate.toISOString().split("T")[0],
      }
    })
    .filter((b) => {
      const days = Math.ceil((new Date(b.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 7
    })
}

// ── Fetch live metrics from Plaid ──────────────────────────────────────────
const IGNORED_SPENDING = new Set(["TRANSFER_IN", "TRANSFER_OUT", "CREDIT_CARD", "LOAN_PAYMENTS"])
const IGNORED_INCOME = new Set(["TRANSFER_OUT", "CREDIT_CARD"])

async function fetchLiveMetrics(profile: Record<string, unknown>) {
  try {
    const accessToken = profile.plaid_access_token as string
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const res = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: thirtyDaysAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
      options: { count: 500, offset: 0 },
    })

    const { accounts, transactions } = res.data

    const accountBalances: AccountBalance[] = accounts.map((a) => ({
      type: a.type as AccountBalance["type"],
      subtype: a.subtype,
      currentBalance: a.balances.current ?? 0,
      availableBalance: a.balances.available ?? null,
    }))

    const spendingAccountIds = new Set(
      accounts.filter((a) => a.type === "depository" || a.type === "credit").map((a) => a.account_id)
    )

    const thisMonth = transactions.filter((t) => {
      const d = new Date(t.date)
      return d >= startOfMonth && d <= now && spendingAccountIds.has(t.account_id)
    })

    const realSpending = thisMonth.filter((t) => {
      const cat = t.personal_finance_category?.primary ?? ""
      return t.amount > 0 && !IGNORED_SPENDING.has(cat)
    })

    const totalSpent = realSpending.reduce((s, t) => s + t.amount, 0)

    const depositIds = new Set(accounts.filter((a) => a.type === "depository").map((a) => a.account_id))
    const observedIncome = transactions
      .filter((t) => {
        const cat = t.personal_finance_category?.primary ?? ""
        return t.amount < 0 && depositIds.has(t.account_id) && !IGNORED_INCOME.has(cat)
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    const selfReported = (profile.monthly_income as number) ?? 0
    const incomeUsed = Math.max(selfReported, observedIncome, totalSpent * 1.5)

    const fixedBills = realSpending
      .filter((t) =>
        t.personal_finance_category?.primary === "RENT_AND_UTILITIES" ||
        t.category?.includes("Rent") ||
        t.category?.includes("Utilities") ||
        t.category?.includes("Insurance")
      )
      .reduce((s, t) => s + t.amount, 0)

    const discretionary = totalSpent - fixedBills

    // Fetch upcoming bills for escrow
    const upcomingBills = await fetchUpcomingBills(profile.clerk_user_id as string, now)

    const sts = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills,
      goalAmount: profile.goal_amount as number | null,
      goalDeadline: profile.goal_deadline as string | null,
      goalStatus: (profile.goal_status as "active" | "completed" | "paused") ?? "active",
      goalSaved: (profile.goal_saved as number) ?? 0,
      safetyBuffer: (profile.safety_buffer as number) ?? 0,
      spentThisMonth: discretionary,
      taxWithholding: (profile.tax_withholding as boolean) ?? false,
      accounts: accountBalances,
      upcomingBills,
    })

    return {
      dailySafeToSpend: sts.dailySafeToSpend,
      remainingBudget: sts.remainingBudget,
      monthlyAvailable: sts.monthlyAvailable,
      daysRemaining: sts.daysRemaining,
      spentThisMonth: Math.round(totalSpent * 100) / 100,
      fixedBills: Math.round(fixedBills * 100) / 100,
      incomeUsed: Math.round(incomeUsed * 100) / 100,
      spendableCash: sts.visualSpendableCash,
      safetyBuffer: sts.safetyBuffer,
      monthlySavingsGoal: sts.monthlySavingsGoal,
      goalCompleted: sts.goalCompleted,
      escrowTotal: sts.escrowTotal,
      escrowedBills: sts.escrowedBills,
    }
  } catch (e) {
    console.error("Failed to fetch live metrics for chat:", e)
    return null
  }
}

// ── POST handler ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { messages } = await req.json()

  // Fetch existing profile for context
  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .single()

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  let systemPrompt = AURORA_SYSTEM_PROMPT.replace("{{CURRENT_DATE}}", currentDate)

  if (profile && profile.onboarded) {
    let bankStatus = ""
    let metricsBlock = ""

    if (profile.bank_linked && profile.plaid_access_token) {
      bankStatus = "Bank linked — use transaction data for Safe-to-Spend. No need to ask about lifestyle spending."
      const metrics = await fetchLiveMetrics(profile)
      if (metrics) {
        const escrowInfo = metrics.escrowedBills.length > 0
          ? `\n- **Escrow active:** $${metrics.escrowTotal} protected for: ${metrics.escrowedBills.map(b => `${b.name} ($${b.amount} due ${b.dueDate})`).join(", ")}`
          : ""
        const goalInfo = metrics.goalCompleted
          ? `\n- **Goal status:** COMPLETED — stop deducting savings, celebrate!`
          : ""

        // Supportive Realist gate — fires when remaining budget is gone or daily
        // is exhausted. Computes a 3-day recovery target the LLM can quote verbatim.
        const isOverBudget = metrics.remainingBudget < 0
        const recoveryDays = Math.min(3, metrics.daysRemaining)
        const recoveryDailyTarget = Math.max(
          0,
          Math.round(metrics.remainingBudget / Math.max(metrics.daysRemaining, 1))
        )
        const toneDirective = isOverBudget
          ? `\n\n## TONE DIRECTIVE — Supportive Realist (ACTIVE)
The user is over budget by $${Math.abs(metrics.remainingBudget)} this month. APPLY the Supportive Realist Tone Gate from the rules above:
- Acknowledge in one short, judgment-free sentence.
- Pivot to the 3-day recovery plan: target **$${recoveryDailyTarget}/day for the next ${recoveryDays} day${recoveryDays === 1 ? "" : "s"}** to get back on track.
- Use "we", end with a question, ≤4 sentences total.
- Do NOT mention past spending beyond that one acknowledgment line.`
          : ""

        metricsBlock = `\n\n## Live Dashboard Metrics (from Plaid — USE THESE NUMBERS, do NOT calculate manually)
- **Daily Safe-to-Spend: $${metrics.dailySafeToSpend}**
- Remaining budget this month: $${metrics.remainingBudget}
- Monthly income used (adjusted): $${metrics.incomeUsed}
- Spent this month: $${metrics.spentThisMonth}
- Fixed bills: $${metrics.fixedBills}
- Monthly goal savings: $${metrics.monthlySavingsGoal}
- Safety buffer: $${metrics.safetyBuffer}
- Spendable cash: ${metrics.spendableCash != null ? "$" + metrics.spendableCash : "N/A"}
- Days remaining: ${metrics.daysRemaining}${escrowInfo}${goalInfo}

CRITICAL: When the user asks about Safe-to-Spend, spending, or budget — ALWAYS use these live numbers. NEVER recalculate from the self-reported income. These numbers already account for observed income, fixed bills, goals, buffer, escrow, and actual spending.${metrics.escrowedBills.length > 0 ? "\n\nESCROW NOTE: The daily limit is lower because I'm protecting money for an upcoming bill. Explain this proactively if the user asks why their limit changed." : ""}${toneDirective}`
      }
    } else {
      // Check for vault statement data
      const { data: latestVault } = await getSupabase()
        .from("vault_uploads")
        .select("total_income, total_spending, fixed_bills, closing_balance, period_start, period_end, filename")
        .eq("clerk_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (latestVault) {
        bankStatus = "No bank linked, but user has uploaded a bank statement. Use the statement data below for financial coaching."
        const balanceInfo = latestVault.closing_balance != null
          ? `\n- **Account closing balance:** $${latestVault.closing_balance}`
          : ""
        metricsBlock = `\n\n## Statement Data (from uploaded statement: ${latestVault.filename})
- **Statement period:** ${latestVault.period_start} to ${latestVault.period_end}
- **Total income:** $${latestVault.total_income}
- **Total spending:** $${latestVault.total_spending}
- **Fixed bills:** $${latestVault.fixed_bills}${balanceInfo}

Use this data to inform your Safe-to-Spend calculations and financial coaching. The closing balance represents how much is actually in this account at the end of the statement — use it as a reality check. If the user asks "how much can I spend," factor in the real balance, not just income minus expenses.

This gives you real spending patterns — you don't need to ask about lifestyle spending categories that are already visible in the statement data. You can still ask about expenses NOT covered by the statement period.`
      } else {
        bankStatus = "NO bank linked, NO statements uploaded — you MUST ask about lifestyle spending (eating out, activities, shopping, subscriptions) to calculate an accurate daily Safe-to-Spend. Ask naturally over the conversation, not all at once."
      }
    }

    const goalStatusLabel = profile.goal_status === "completed"
      ? "COMPLETED"
      : profile.goal_status === "paused"
      ? "PAUSED"
      : "active"
    const goalProgress = profile.goal_amount
      ? Math.min(100, Math.round(((profile.goal_saved ?? 0) / profile.goal_amount) * 100))
      : 0
    const pointsInfo = profile.bank_linked
      ? `Financial Karma: ${profile.points ?? 0} pts | Streak: ${profile.points_streak ?? 0} days | Best: ${profile.longest_streak ?? 0} days`
      : "Financial Karma: N/A (Plaid-only perk — bank not linked)"

    systemPrompt += `\n\n## Current User Profile (already onboarded — skip discovery, go straight to coaching)
- Name: ${profile.name}
- Job: ${profile.job} (${profile.income_type ?? "unknown"} income)
- Monthly income (self-reported): $${profile.monthly_income?.toLocaleString() ?? "unknown"}
- Goal: ${profile.goal_description ?? "not set"} — $${profile.goal_amount?.toLocaleString() ?? "?"} by ${profile.goal_deadline ?? "no deadline"} (saved: $${profile.goal_saved ?? 0} — ${goalProgress}% — status: ${goalStatusLabel})
- Safety buffer: $${profile.safety_buffer ?? 0} (${profile.buffer_type ?? "flat_monthly"})
- Income calculation: ${profile.income_calc_method ?? "average"} month
- Tax withholding: ${profile.tax_withholding ? "yes (25%)" : "no"}
- Household: ${profile.household_type ?? "individual"}
- ${pointsInfo}
- Bank status: ${bankStatus}${metricsBlock}

IMPORTANT: This user is already onboarded. Do NOT re-ask their name, job, income, goal, or buffer. Greet them by name and jump into coaching.`
  } else if (profile) {
    // Partially onboarded — tell Aurora what's missing
    const collected: string[] = []
    const missing: string[] = []
    if (profile.name) collected.push(`Name: ${profile.name}`)
    else missing.push("name")
    if (profile.job) collected.push(`Job: ${profile.job}`)
    else missing.push("job")
    if (profile.monthly_income) collected.push(`Income: $${profile.monthly_income}`)
    else missing.push("monthly income")
    if (profile.goal_amount != null) collected.push(`Goal: $${profile.goal_amount}`)
    else missing.push("financial goal (amount + deadline)")
    if (profile.safety_buffer != null && profile.safety_buffer > 0) collected.push(`Buffer: $${profile.safety_buffer}`)
    else missing.push("safety buffer preference")

    systemPrompt += `\n\n## Partial Profile — Continue Discovery
Already collected: ${collected.join(", ") || "nothing yet"}
Still need: ${missing.join(", ")}
Pick up where you left off. Don't re-ask what you already know.`
  }

  // First call — may include tool calls
  const completion = await openai.chat.completions.create({
    model: "o4-mini",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    tools,
  })

  let response = completion.choices[0].message

  // Track whether profile was updated so the frontend can refresh the dashboard
  let profileUpdated = false
  let spendingUpdated = false

  // Handle tool calls in a loop (Aurora may call save_profile_data)
  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages,
    response,
  ]

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      if (toolCall.type !== "function") continue
      const args = JSON.parse(toolCall.function.arguments)
      let result: Record<string, unknown>

      if (toolCall.function.name === "save_profile_data") {
        result = await executeSaveProfile(userId, args)
        if (result.success) profileUpdated = true
      } else if (toolCall.function.name === "save_recurring_bill") {
        result = await executeSaveRecurringBill(userId, args)
        if (result.success) profileUpdated = true
      } else if (toolCall.function.name === "report_spending") {
        result = await executeReportSpending(userId, args)
        if (result.success) spendingUpdated = true
      } else {
        result = { error: "Unknown function" }
      }

      allMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }

    // Get the follow-up response after tool execution
    const followUp = await openai.chat.completions.create({
      model: "o4-mini",
      messages: allMessages,
      tools,
    })

    response = followUp.choices[0].message
    allMessages.push(response)
  }

  return NextResponse.json({ message: response.content, profileUpdated, spendingUpdated })
}
