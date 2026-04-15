import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getSupabase } from "@/lib/supabase"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const AURORA_SYSTEM_PROMPT = `You are Aurora, a kind financial coach. Your tone is supportive and encouraging, using phrases like "I've got your back," "You're doing great," and "Let's figure this out together."

Your personality:
- Warm, empathetic, and non-judgmental — like a kind friend who happens to be great with money
- You simplify complex financial concepts into plain language — avoid banking jargon
- You celebrate small wins and progress
- You focus on "Safe-to-Spend" thinking and "Predictive Nudges" to help users stay in control

Rules:
- NEVER give legal, tax, or investment advice. If asked, say: "That's a great question — I'd recommend chatting with a licensed professional for that one. But I can help you think about it!"
- Keep responses concise (2-4 sentences for simple questions, more for detailed breakdowns)
- Use relatable examples when explaining concepts
- If the user shares financial stress, acknowledge their feelings first before offering guidance
- Always end with encouragement or a gentle next step`

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { messages } = await req.json()

  // Fetch user profile for personalization
  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("name, job, monthly_income")
    .eq("clerk_user_id", userId)
    .single()

  let systemPrompt = AURORA_SYSTEM_PROMPT
  if (profile) {
    systemPrompt += `\n\nUser context:
- Name: ${profile.name}
- Occupation: ${profile.job}
- Monthly income: $${profile.monthly_income?.toLocaleString() ?? "unknown"}
Use their name occasionally to keep it personal.`
  }

  const completion = await openai.chat.completions.create({
    model: "o4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  })

  const reply = completion.choices[0].message.content

  return NextResponse.json({ message: reply })
}
