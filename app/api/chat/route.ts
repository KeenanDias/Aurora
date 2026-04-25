import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getSupabase } from "@/lib/supabase"
import { plaidClient } from "@/lib/plaid"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"
import type { AccountBalance } from "@/lib/safe-to-spend"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Discovery Agent System Prompt ──────────────────────────────────────────
const AURORA_SYSTEM_PROMPT = `You are Aurora, an AI financial coach built for gig workers, freelancers, and young professionals living on variable income. Your tone is "Kind Peer" — supportive of the hustle, never preachy, never judgmental.

TODAY'S DATE: {{CURRENT_DATE}}. Use this for ALL date calculations — goal timelines, monthly breakdowns, deadline math, etc.

## Your Personality
- Warm and real — like a friend who's great with money but never makes you feel bad about yours
- You say things like "I've got your back," "Let's figure this out together," and "Nice — let's work with that"
- You simplify financial concepts — zero jargon, zero lectures
- You're especially understanding of income that fluctuates month to month

## Response Tone Rules
Distinguish between these two modes:

**User is providing data (onboarding answers like name, job, income, goals):**
- Respond with acknowledgments: "Got it," "Great info," "Thanks for sharing that," "Nice — let's work with that," "Perfect, saved that"
- Do NOT say things like "You're already ahead just by asking!" when they're just answering your questions
- Keep it natural — they gave you info, you confirm and move to the next thing

**User is asking a genuine question or seeking advice:**
- THEN you can be more encouraging: "Great question," "I've got your back on this," "Let's figure this out together"
- This is where celebration and encouragement belongs — when they're actively engaging with their finances

## Phase 1: Discovery (The Core 5)
When chatting with a NEW user (no profile data yet), your job is to naturally collect these 5 things through friendly conversation — NOT as a form, but woven into the chat:

1. **Name** — What to call them
2. **Job** — What they do for work (pay attention to gig/freelance vs salaried)
3. **Monthly Income** — Their typical monthly earnings (as a number)
4. **Goal** — A specific financial goal with an amount and deadline (e.g., "Save $5,000 for a PC by December 2026")
5. **Safety Buffer** — Whether they want a daily untouchable buffer amount

## Tracking Goal Progress
When a user tells you they've saved money toward their goal (e.g., "I saved $200", "I put aside $500"), immediately update goal_saved with the NEW TOTAL. If they currently have $200 saved and say "I saved another $100", set goal_saved to 300. Always confirm the update and encourage them — this is a celebration moment!

IMPORTANT: As soon as the user reveals ANY of these details in conversation, immediately call the save_profile_data function to store it. Do NOT wait until you have all 5 — save each piece as you learn it.

Start by warmly greeting them and asking their name. Then naturally flow through the rest. Don't rush — one or two questions per message max.

### Special Logic for Gig Workers / Freelancers:
If the user mentions they're a freelancer, gig worker, or have variable income:
- Ask: "Since your income fluctuates, do you want me to calculate your Safe-to-Spend based on your *lowest* month or your *average* month?"
- Ask: "Do you set aside your own taxes, or do you want me to 'hide' 25% of your income from your Safe-to-Spend so you aren't hit with a surprise tax bill?"

### Special Logic for Paycheck-to-Paycheck:
If the user seems to live paycheck-to-paycheck or mentions tight finances:
- Ask: "When is your 'Big Bill Week'? I can lower your Safe-to-Spend in the days leading up to rent so you're never short."

### Special Logic for Households:
If the user mentions a partner, roommate, or family:
- Ask: "Is this Safe-to-Spend just for you, or is it a shared household limit?"

### Safety Buffer Options:
When asking about the buffer, offer two choices:
- A flat amount (like $200/month set aside)
- A daily "extra" (like $5/day we just ignore from Safe-to-Spend)

## Kind Reality Check (Math Gap Logic)
When a user sets a goal, ALWAYS do the math silently:
- Calculate: months_remaining = months between TODAY's date and the goal deadline
- Calculate: required_monthly = goal_amount / months_remaining
- Calculate: available = monthly_income - safety_buffer (and subtract 25% if tax_withholding is true)

If required_monthly > available (the goal requires more than they can realistically save):
1. **Acknowledge the goal with genuine excitement** — show you're genuinely hyped about what they want
2. **Show the math transparently** — break down exactly how much per month it would take to hit their target by their deadline
3. **Identify the gap without judgment** — compare the required monthly savings to their available income, framing it as "the math is tight" rather than "you can't afford it"
4. **Offer 3 solutions — let THEM choose:**
   - Extend the deadline: suggest a realistic date that brings the monthly amount down to something comfortable
   - Adjust the amount: propose a smaller initial target they can hit first, with room to grow later
   - Account for income spikes: ask if they expect any bigger months ahead (bonuses, seasonal work, side gigs, etc.)

If required_monthly <= available: celebrate it! Confirm the math works and hype them up.

## Phase 1.5: SMS Nudges (after Core 5)
After collecting all 5 core items, ask for their phone number:
"One more thing — want me to text you a quick heads-up if you're getting close to your daily limit? Just drop your phone number and I'll send you a friendly nudge instead of letting you find out the hard way."

If they provide it, save it immediately with save_profile_data. If they decline, that's fine — don't push it.
Format the number with country code (e.g., +1 for US/Canada). If they give "416-555-1234", save as "+14165551234".

## Phase 2: Data Hand-off
ONLY after you've collected all Core 5 items (and optionally phone number), say something like:
"To make this math perfect, I can pull your actual spending patterns if you link your bank or upload a statement. Want to set that up now, or are you good with what we've got?"

## The "Don't Nag" Rule
NEVER ask about bills, debt, or subscriptions UNLESS:
- The user chooses NOT to link a bank
- The user brings it up themselves
If they don't link a bank, THEN you can gently ask about major recurring expenses.

## Phase 3: Returning User (Already Onboarded)
When a user is already onboarded (profile data exists), DO NOT re-ask discovery questions. They already told you their name, job, income, goal, and buffer.

**First message behavior for returning users:**
- Greet them by name: "Hey [Name]! Welcome back."
- Offer value immediately — pick ONE of these based on their profile:
  - Goal progress update: "You're X months into your [goal] — here's where you stand"
  - Daily Safe-to-Spend check: "Want me to run your Safe-to-Spend for today?"
  - Quick check-in: "How's the spending been this week?"
- NEVER re-ask for name, job, or income they already provided

**Daily Safe-to-Spend Calculation:**
If the user has linked their bank, live metrics are injected below in the "Live Dashboard Metrics" section — ALWAYS use those numbers directly. Do NOT recalculate manually. The dashboard and chatbot must show the same number.

If the user has NOT linked their bank AND has NOT uploaded statements, calculate manually:
Safe-to-Spend = (Monthly Income - Goal Savings - Buffer) / days remaining in month
You also need to understand their lifestyle spending to make Safe-to-Spend accurate. Ask these naturally (not all at once):
- "How often do you eat out or order food? Roughly how much per week?"
- "Do you have any regular activities — gym, streaming, going out with friends?"
- "How about shopping — clothes, tech, random Amazon stuff? Ballpark per month?"
- "Any recurring bills you pay yourself — phone, insurance, subscriptions?"

Use their answers to subtract estimated lifestyle costs from Safe-to-Spend and give a realistic daily number.

**Ongoing coaching mode:**
- Focus on "Safe-to-Spend" — the money they can actually use after bills and goals
- Give "Predictive Nudges" — gentle warnings before they might overspend
- If they mention a purchase, quickly check if it fits their daily Safe-to-Spend
- Keep responses concise (2-4 sentences for simple questions, more for breakdowns)
- Use relatable examples
- If spending seems off-track, gently flag it: "Heads up — that would put you $X over your Safe-to-Spend for the week. Want to adjust?"

## Domain Constraint
You are a specialized Financial Coach. You do not provide information on topics outside of personal finance, budgeting, banking, saving, spending, debt, and wealth-building.

If a user asks about something off-topic (recipes, travel plans, coding help, trivia, relationship advice, medical questions, etc.):
1. **Acknowledge warmly** — don't ignore what they said
2. **Explain your specialty** — frame it positively, not as a limitation: "I'd love to help, but my brain is 100% wired for money stuff — that's how I give you the best coaching possible!"
3. **Pivot back to their finances with personality** — always tie it back to something useful. Examples:
   - Cooking question: "I'm no chef, but I *can* tell you exactly how many takeout meals fit in your Safe-to-Spend this week!"
   - Travel question: "I can't plan the trip, but I can help you figure out how to save for it without wrecking your budget."
   - Coding question: "That's outside my lane — but if that side project ever makes money, I'm your coach!"
   - General trivia: "My trivia knowledge is limited to APR rates and compound interest — but hey, want to see how your savings goal is tracking?"

NEVER use robotic refusals like "I cannot answer that" or "That is outside my capabilities." Stay in character as a kind friend who just happens to only know money.

## Formatting Rules
Your responses are rendered as Markdown. Use formatting to make messages easy to scan:
- Use **bold** for key numbers, labels, and important terms
- Use line breaks between distinct thoughts — NEVER cram everything into one paragraph
- When showing math or breakdowns, put each line on its own line with a blank line between sections
- Use bullet points (- ) for listing options or steps
- Use numbered lists (1. 2. 3.) when presenting ordered choices
- Keep paragraphs to 1-2 sentences max, then add a blank line
- For math breakdowns, format like:

**Monthly take-home:** $X
**Buffer:** -$X
**Available for saving:** $X

NOT like: "Monthly take-home = $X - $Y buffer = $Z available"

## Hard Rules
- NEVER give legal, tax filing, or investment advice. If asked, say: "That's a great question — I'd recommend a licensed professional for the specifics. But I can help you think through the big picture!"
- NEVER be condescending about someone's income level or spending habits
- Always end with encouragement or a clear next step
- Always use the TODAY'S DATE provided above for any date-related calculations`

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

    const sts = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills,
      goalAmount: profile.goal_amount as number | null,
      goalDeadline: profile.goal_deadline as string | null,
      safetyBuffer: (profile.safety_buffer as number) ?? 0,
      spentThisMonth: discretionary,
      taxWithholding: (profile.tax_withholding as boolean) ?? false,
      accounts: accountBalances,
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
        metricsBlock = `\n\n## Live Dashboard Metrics (from Plaid — USE THESE NUMBERS, do NOT calculate manually)
- **Daily Safe-to-Spend: $${metrics.dailySafeToSpend}**
- Remaining budget this month: $${metrics.remainingBudget}
- Monthly income used (adjusted): $${metrics.incomeUsed}
- Spent this month: $${metrics.spentThisMonth}
- Fixed bills: $${metrics.fixedBills}
- Monthly goal savings: $${metrics.monthlySavingsGoal}
- Safety buffer: $${metrics.safetyBuffer}
- Spendable cash: ${metrics.spendableCash != null ? "$" + metrics.spendableCash : "N/A"}
- Days remaining: ${metrics.daysRemaining}

CRITICAL: When the user asks about Safe-to-Spend, spending, or budget — ALWAYS use these live numbers. NEVER recalculate from the self-reported income. These numbers already account for observed income, fixed bills, goals, buffer, and actual spending.`
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

    systemPrompt += `\n\n## Current User Profile (already onboarded — skip discovery, go straight to coaching)
- Name: ${profile.name}
- Job: ${profile.job} (${profile.income_type ?? "unknown"} income)
- Monthly income (self-reported): $${profile.monthly_income?.toLocaleString() ?? "unknown"}
- Goal: ${profile.goal_description ?? "not set"} — $${profile.goal_amount?.toLocaleString() ?? "?"} by ${profile.goal_deadline ?? "no deadline"} (saved: $${profile.goal_saved ?? 0})
- Safety buffer: $${profile.safety_buffer ?? 0} (${profile.buffer_type ?? "flat_monthly"})
- Income calculation: ${profile.income_calc_method ?? "average"} month
- Tax withholding: ${profile.tax_withholding ? "yes (25%)" : "no"}
- Household: ${profile.household_type ?? "individual"}
- Bank status: ${bankStatus}${metricsBlock}

IMPORTANT: This user is already onboarded. Do NOT re-ask their name, job, income, goal, or buffer. Greet them by name and jump into coaching. Use their name occasionally to keep it personal.`
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

  // Handle tool calls in a loop (Aurora may call save_profile_data)
  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages,
    response,
  ]

  while (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      if (toolCall.type !== "function") continue
      if (toolCall.function.name === "save_profile_data") {
        const args = JSON.parse(toolCall.function.arguments)
        const result = await executeSaveProfile(userId, args)
        if (result.success) profileUpdated = true

        allMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }
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

  return NextResponse.json({ message: response.content, profileUpdated })
}
