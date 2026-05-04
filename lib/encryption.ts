import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

const ALGORITHM = "aes-256-gcm"

/**
 * Key versioning: master keys are stored as VAULT_ENCRYPTION_KEY_V{N} env vars.
 *
 * - VAULT_ACTIVE_KEY_VERSION (defaults to 1) — the version used for new writes.
 * - VAULT_ENCRYPTION_KEY_V1, _V2, … — 64-hex-char (32-byte) keys, one per version.
 *
 * Backwards compatibility: if VAULT_ENCRYPTION_KEY (unversioned) is set and no
 * V1 key exists, it is used as V1. This keeps existing deployments working.
 *
 * Decryption resolves the key via the version stored alongside each ciphertext
 * row in the database (see `key_version` column on vault_uploads). Rotating
 * the active key never invalidates older data — old rows keep decrypting with
 * their original key version.
 */

const KEY_CACHE = new Map<number, Buffer>()

function getKeyForVersion(version: number): Buffer {
  if (KEY_CACHE.has(version)) return KEY_CACHE.get(version)!

  const explicit = process.env[`VAULT_ENCRYPTION_KEY_V${version}`]
  const fallback = version === 1 ? process.env.VAULT_ENCRYPTION_KEY : undefined
  const hex = explicit ?? fallback

  if (!hex) {
    throw new Error(
      `Missing VAULT_ENCRYPTION_KEY_V${version}. Set it in env or rotate VAULT_ACTIVE_KEY_VERSION to a defined version.`
    )
  }
  if (hex.length !== 64) {
    throw new Error(`VAULT_ENCRYPTION_KEY_V${version} must be 64 hex chars (32 bytes); got ${hex.length}.`)
  }

  const buf = Buffer.from(hex, "hex")
  KEY_CACHE.set(version, buf)
  return buf
}

export function getActiveKeyVersion(): number {
  const raw = process.env.VAULT_ACTIVE_KEY_VERSION
  const parsed = raw ? parseInt(raw, 10) : 1
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return parsed
}

/**
 * Encrypt a buffer with AES-256-GCM using the currently active key version.
 * Returns the ciphertext, IV, auth tag, and the keyVersion used so callers
 * can persist it alongside the row.
 */
export function encryptBuffer(data: Buffer): {
  encrypted: string
  iv: string
  authTag: string
  keyVersion: number
} {
  const keyVersion = getActiveKeyVersion()
  const key = getKeyForVersion(keyVersion)
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    keyVersion,
  }
}

/**
 * Decrypt hex-encoded data. Caller must pass the keyVersion stored on the row.
 * Defaults to v1 for legacy rows that predate the key_version column.
 */
export function decryptBuffer(
  encryptedHex: string,
  ivHex: string,
  authTagHex: string,
  keyVersion: number = 1
): Buffer {
  const key = getKeyForVersion(keyVersion)
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ])
}
