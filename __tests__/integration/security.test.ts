import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

describe("Security Audit", () => {
  describe("VAULT_ENCRYPTION_KEY never exposed to client", () => {
    const CLIENT_DIRS = ["app", "components"]
    const SENSITIVE_VARS = [
      "VAULT_ENCRYPTION_KEY",
      "PLAID_SECRET",
      "OPENAI_API_KEY",
      "TWILIO_AUTH_TOKEN",
      "CRON_SECRET",
    ]

    function getClientFiles(dir: string, files: string[] = []): string[] {
      try {
        const entries = readdirSync(join(process.cwd(), dir), { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            getClientFiles(fullPath, files)
          } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
            files.push(fullPath)
          }
        }
      } catch {
        // directory doesn't exist
      }
      return files
    }

    for (const varName of SENSITIVE_VARS) {
      it(`${varName} is not referenced in client-side code`, () => {
        const clientFiles: string[] = []
        for (const dir of CLIENT_DIRS) {
          getClientFiles(dir, clientFiles)
        }

        const violations: string[] = []
        for (const file of clientFiles) {
          // Skip server-only files (API routes, server actions)
          if (file.includes("/api/") || file.includes("server")) continue

          // Only check files that could be client components
          const content = readFileSync(join(process.cwd(), file), "utf-8")
          if (content.includes(`process.env.${varName}`) || content.includes(`"${varName}"`)) {
            // Check if this is actually a server file
            if (!content.includes('"use client"') && !file.endsWith(".tsx")) continue
            if (content.includes('"use client"')) {
              violations.push(`${file} references ${varName}`)
            }
          }
        }

        expect(violations).toEqual([])
      })
    }
  })

  describe("Sensitive env vars use NEXT_PUBLIC_ correctly", () => {
    it("VAULT_ENCRYPTION_KEY is not prefixed with NEXT_PUBLIC_", () => {
      // If someone accidentally makes it public
      expect(process.env.NEXT_PUBLIC_VAULT_ENCRYPTION_KEY).toBeUndefined()
    })

    it("PLAID_SECRET is not prefixed with NEXT_PUBLIC_", () => {
      expect(process.env.NEXT_PUBLIC_PLAID_SECRET).toBeUndefined()
    })

    it("OPENAI_API_KEY is not prefixed with NEXT_PUBLIC_", () => {
      expect(process.env.NEXT_PUBLIC_OPENAI_API_KEY).toBeUndefined()
    })
  })

  describe("File upload validation", () => {
    it("vault upload route checks file type", async () => {
      // Read the upload route source to verify it validates file type
      const uploadRoute = readFileSync(
        join(process.cwd(), "app/api/vault/upload/route.ts"),
        "utf-8"
      )

      // Verify the route checks for PDF content type
      expect(uploadRoute).toContain('file.type !== "application/pdf"')
      // Verify it has a file size limit
      expect(uploadRoute).toContain("10 * 1024 * 1024")
    })

    it("cron endpoint requires authorization header", () => {
      const cronRoute = readFileSync(
        join(process.cwd(), "app/api/cron/daily-nudge/route.ts"),
        "utf-8"
      )

      expect(cronRoute).toContain("authorization")
      expect(cronRoute).toContain("CRON_SECRET")
      expect(cronRoute).toContain("401")
    })
  })

  describe("Encryption implementation audit", () => {
    it("uses AES-256-GCM (not CBC or ECB)", () => {
      const encryptionCode = readFileSync(
        join(process.cwd(), "lib/encryption.ts"),
        "utf-8"
      )

      expect(encryptionCode).toContain("aes-256-gcm")
      expect(encryptionCode).not.toContain("aes-256-cbc")
      expect(encryptionCode).not.toContain("aes-256-ecb")
    })

    it("uses randomBytes for IV generation (not static)", () => {
      const encryptionCode = readFileSync(
        join(process.cwd(), "lib/encryption.ts"),
        "utf-8"
      )

      expect(encryptionCode).toContain("randomBytes")
      // Should NOT have a hardcoded IV
      expect(encryptionCode).not.toMatch(/iv\s*=\s*["']/)
    })

    it("uses getAuthTag for GCM authentication", () => {
      const encryptionCode = readFileSync(
        join(process.cwd(), "lib/encryption.ts"),
        "utf-8"
      )

      expect(encryptionCode).toContain("getAuthTag")
      expect(encryptionCode).toContain("setAuthTag")
    })
  })
})
