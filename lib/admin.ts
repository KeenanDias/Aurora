import { currentUser } from "@clerk/nextjs/server"

/**
 * Returns true if the currently signed-in Clerk user's primary email
 * appears in the comma-separated ADMIN_EMAILS env var.
 *
 * Set ADMIN_EMAILS in .env.local — e.g. "diaskeenana@gmail.com,other@admin.com"
 */
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false

  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowed.length === 0) return false

  const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase())
  return userEmails.some((e) => allowed.includes(e))
}

export async function getAdminEmail(): Promise<string | null> {
  const user = await currentUser()
  return user?.emailAddresses[0]?.emailAddress ?? null
}
