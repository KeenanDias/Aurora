import { describe, it, expect } from "vitest"
import { encryptBuffer, decryptBuffer } from "@/lib/encryption"

// Set a test encryption key (32 bytes = 64 hex chars)
process.env.VAULT_ENCRYPTION_KEY = "a".repeat(64)

describe("AES-256-GCM Encryption", () => {
  it("encrypt → decrypt returns identical data", () => {
    const original = Buffer.from("This is a bank statement PDF content with sensitive data.")

    const { encrypted, iv, authTag } = encryptBuffer(original)
    const decrypted = decryptBuffer(encrypted, iv, authTag)

    expect(decrypted.equals(original)).toBe(true)
    expect(decrypted.toString()).toBe(original.toString())
  })

  it("encrypts binary data (PDF-like) correctly", () => {
    // Simulate binary PDF content
    const original = Buffer.alloc(1024)
    for (let i = 0; i < 1024; i++) original[i] = i % 256

    const { encrypted, iv, authTag } = encryptBuffer(original)
    const decrypted = decryptBuffer(encrypted, iv, authTag)

    expect(decrypted.equals(original)).toBe(true)
  })

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const original = Buffer.from("Same content encrypted twice")

    const result1 = encryptBuffer(original)
    const result2 = encryptBuffer(original)

    // IVs should differ (random)
    expect(result1.iv).not.toBe(result2.iv)
    // Ciphertext should differ
    expect(result1.encrypted).not.toBe(result2.encrypted)

    // But both decrypt to the same plaintext
    expect(decryptBuffer(result1.encrypted, result1.iv, result1.authTag).toString())
      .toBe(original.toString())
    expect(decryptBuffer(result2.encrypted, result2.iv, result2.authTag).toString())
      .toBe(original.toString())
  })

  it("rejects tampered ciphertext (GCM authentication)", () => {
    const original = Buffer.from("Tamper-proof content")

    const { encrypted, iv, authTag } = encryptBuffer(original)

    // Flip a character in the ciphertext
    const tampered = encrypted.slice(0, -2) + "ff"

    expect(() => decryptBuffer(tampered, iv, authTag)).toThrow()
  })

  it("rejects wrong auth tag", () => {
    const original = Buffer.from("Auth tag validation")

    const { encrypted, iv } = encryptBuffer(original)
    const wrongTag = "0".repeat(32) // 16 bytes as hex

    expect(() => decryptBuffer(encrypted, iv, wrongTag)).toThrow()
  })

  it("handles empty buffer", () => {
    const original = Buffer.alloc(0)

    const { encrypted, iv, authTag } = encryptBuffer(original)
    const decrypted = decryptBuffer(encrypted, iv, authTag)

    expect(decrypted.length).toBe(0)
  })

  it("handles large files (5MB)", () => {
    const original = Buffer.alloc(5 * 1024 * 1024, "x")

    const { encrypted, iv, authTag } = encryptBuffer(original)
    const decrypted = decryptBuffer(encrypted, iv, authTag)

    expect(decrypted.length).toBe(original.length)
    expect(decrypted.equals(original)).toBe(true)
  })

  it("IV is 12 bytes (96 bits) as required by GCM", () => {
    const original = Buffer.from("IV length check")
    const { iv } = encryptBuffer(original)

    // IV is hex-encoded, 12 bytes = 24 hex chars
    expect(iv.length).toBe(24)
  })

  it("auth tag is 16 bytes (128 bits)", () => {
    const original = Buffer.from("Auth tag length check")
    const { authTag } = encryptBuffer(original)

    // Auth tag is hex-encoded, 16 bytes = 32 hex chars
    expect(authTag.length).toBe(32)
  })
})
