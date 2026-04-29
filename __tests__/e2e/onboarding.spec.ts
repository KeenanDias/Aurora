import { test, expect } from "@playwright/test"

// E2E tests require the dev server running and a test user authenticated.
// In CI, mock Clerk auth with a test session cookie.
// Locally, sign in first and the browser context will have the session.

test.describe("Onboarding Happy Path", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard — will redirect to sign-in if not authenticated
    await page.goto("/dashboard")

    // If redirected to sign-in, we need a test account
    // For local testing: sign in manually first, then run tests
    // For CI: set CLERK_TEST_TOKEN env var and inject session
    if (page.url().includes("sign-in")) {
      test.skip(true, "Skipping — no authenticated session. Sign in manually before running E2E tests.")
    }
  })

  test("dashboard loads with metrics cards", async ({ page }) => {
    // Wait for the dashboard to render
    await expect(page.locator("h1")).toContainText("Your Dashboard")

    // Verify all 5 metric cards are present
    const metricLabels = [
      "Daily Safe-to-Spend",
      "Spendable Cash",
      "Spent This Month",
      "Monthly Goal Savings",
      "Safety Buffer",
    ]

    for (const label of metricLabels) {
      await expect(page.getByText(label)).toBeVisible()
    }
  })

  test("chat window opens and Aurora greets user", async ({ page }) => {
    // Find and click the chat button (the Aurora "A" icon)
    const chatButton = page.locator("button").filter({ has: page.locator("text=A") }).last()
    await chatButton.click()

    // Wait for chat window to appear
    const chatWindow = page.locator("[class*='rounded-2xl']").filter({ hasText: "Aurora" })
    await expect(chatWindow).toBeVisible({ timeout: 5000 })

    // Wait for Aurora's greeting message
    const messageArea = page.locator("[class*='overflow-y-auto']")
    await expect(messageArea).toBeVisible({ timeout: 10000 })

    // Aurora should have sent a greeting
    const messages = messageArea.locator("[class*='rounded']")
    await expect(messages.first()).toBeVisible({ timeout: 15000 })
  })

  test("user can send a message in chat", async ({ page }) => {
    // Open chat
    const chatButton = page.locator("button").filter({ has: page.locator("text=A") }).last()
    await chatButton.click()

    // Type a message
    const input = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]')
    await expect(input).toBeVisible({ timeout: 5000 })
    await input.fill("Hello Aurora")

    // Send it
    const sendButton = page.locator('button[type="submit"]')
    await sendButton.click()

    // Message should appear in chat
    await expect(page.getByText("Hello Aurora")).toBeVisible({ timeout: 5000 })

    // Wait for Aurora's response (green dot should appear then disappear)
    await page.waitForTimeout(3000)
  })

  test("vault page loads and shows upload option", async ({ page }) => {
    await page.goto("/dashboard/vault")

    // Should see the vault page
    await expect(page.getByText("Data Vault")).toBeVisible()

    // Should see upload area
    await expect(page.getByText(/upload|statement/i).first()).toBeVisible()
  })

  test("vault rejects non-PDF files", async ({ page }) => {
    await page.goto("/dashboard/vault")

    // Try to upload a .txt file via the API directly
    const response = await page.request.post("/api/vault/upload", {
      multipart: {
        file: {
          name: "malicious.js",
          mimeType: "application/javascript",
          buffer: Buffer.from("alert('xss')"),
        },
      },
    })

    // Should be rejected
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("PDF")
  })

  test("cron endpoint rejects unauthorized requests", async ({ page }) => {
    const response = await page.request.get("/api/cron/daily-nudge")

    expect(response.status()).toBe(401)
  })

  test("cron endpoint accepts valid bearer token", async ({ page }) => {
    const response = await page.request.get("/api/cron/daily-nudge", {
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    })

    // Should succeed (200) or fail gracefully (500 if no users), but NOT 401
    expect(response.status()).not.toBe(401)
  })
})
