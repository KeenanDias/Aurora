import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { CountryCode, Products } from "plaid"

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Aurora AI",
    products: [Products.Transactions, Products.Auth],
    country_codes: [CountryCode.Us, CountryCode.Ca],
    language: "en",
  })

  return NextResponse.json({ link_token: response.data.link_token })
}
