import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getEncryptionKey(): Buffer {
  const key = process.env.VAULT_ENCRYPTION_KEY
  if (!key) throw new Error("Missing VAULT_ENCRYPTION_KEY environment variable")
  // Key must be 32 bytes (64 hex chars) for AES-256
  return Buffer.from(key, "hex")
}

/**
 * Encrypt a buffer with AES-256-GCM.
 * Returns { encrypted, iv, authTag } — all as hex strings for Supabase storage.
 */
export function encryptBuffer(data: Buffer): {
  encrypted: string
  iv: string
  authTag: string
} {
  const key = getEncryptionKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  }
}

/**
 * Decrypt hex-encoded data encrypted with AES-256-GCM.
 */
export function decryptBuffer(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string
): Buffer {
  const key = getEncryptionKey()
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex")
  )
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ])
}
