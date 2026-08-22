import crypto from 'crypto'
import { getInternalPepper } from './auth'

/**
 * Envelope encryption for sensitive values at rest (audit M-5: card/wallet
 * payout numbers were stored as plaintext JSON in the Config table).
 *
 * Format: enc1.<iv>.<tag>.<ciphertext>  (base64url parts)
 * Key:    scrypt(PAYLOAD_ENCRYPTION_KEY || bot-token-derived pepper)
 *
 * Readers MUST treat any value not starting with "enc1." as legacy plaintext
 * and migrate it on next write — this keeps the rollout backward-compatible.
 */

const PREFIX = 'enc1'

function masterKey(): Buffer | null {
  const explicit = process.env.PAYLOAD_ENCRYPTION_KEY
  const secret = explicit || process.env.TELEGRAM_BOT_TOKEN
  if (!secret) return null
  // Salt is public derivation domain separation, not secrecy.
  return crypto.scryptSync(secret, `zerf-crypto-box:${getInternalPepper() || 'default'}`, 32)
}

export function encryptJson(value: unknown): string | null {
  const key = masterKey()
  if (!key) {
    console.error('[crypto-box] No PAYLOAD_ENCRYPTION_KEY/TELEGRAM_BOT_TOKEN configured — cannot encrypt')
    return null
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), 'utf8')),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  const b64u = (b: Buffer) => b.toString('base64url')
  return `${PREFIX}.${b64u(iv)}.${b64u(tag)}.${b64u(data)}`
}

export function decryptJson<T = unknown>(stored: string | null | undefined): T | null {
  if (!stored || !stored.startsWith(`${PREFIX}.`)) return null
  try {
    const [, ivB64, tagB64, dataB64] = stored.split('.')
    const key = masterKey()
    if (!key) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ])
    return JSON.parse(plain.toString('utf8')) as T
  } catch {
    // wrong key / tampered ciphertext
    return null
  }
}

/**
 * Unified reader for payout-card Config rows: transparently supports the
 * legacy plaintext JSON format during migration and the new envelope.
 */
export function parseStoredCard<T = any>(rawValue: string | null | undefined): T | null {
  if (!rawValue) return null
  const decrypted = decryptJson<T>(rawValue)
  if (decrypted) return decrypted
  try {
    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}
