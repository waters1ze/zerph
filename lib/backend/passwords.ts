import crypto from 'crypto'
import { secretsMatch } from './auth'

/**
 * Password hashing.
 *
 * Current format: pbkdf2$<iterations>$<saltHex>$<hashHex>  (per-user random salt, 600k iterations)
 * Legacy format:  64-char hex produced by pbkdf2Sync(pw, 'zerf_salt_2026', 1000) — static salt.
 *
 * verifyPassword() accepts both; on successful legacy verification callers should
 * re-hash with hashPassword() to upgrade the stored value transparently.
 */

const PBKDF2_ITERATIONS = 600_000
const KEY_LEN = 32
const DIGEST = 'sha256'
const LEGACY_SALT = 'zerf_salt_2026'
const LEGACY_ITERATIONS = 1000

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, DIGEST)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Verifies a password against stored hash (new or legacy format). */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  if (stored.startsWith('pbkdf2$')) {
    const parts = stored.split('$')
    if (parts.length !== 4) return false
    const iterations = parseInt(parts[1], 10)
    const salt = Buffer.from(parts[2], 'hex')
    const expected = Buffer.from(parts[3], 'hex')
    if (!Number.isFinite(iterations) || iterations < 1 || salt.length === 0) return false
    const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, DIGEST)
    return crypto.timingSafeEqual(actual, expected)
  }
  // Legacy static-salt hash
  const legacy = crypto.pbkdf2Sync(password, LEGACY_SALT, LEGACY_ITERATIONS, KEY_LEN, DIGEST).toString('hex')
  return secretsMatch(legacy, stored)
}

export function isLegacyPasswordHash(stored: string | null | undefined): boolean {
  return Boolean(stored) && !stored!.startsWith('pbkdf2$')
}

/** Random account ID for email-registered users (10 digits, "90" prefix). */
export function generateEmailChatId(): bigint {
  const rand = crypto.randomBytes(4).readUInt32BE(0) % 100_000_000
  return BigInt(`90${String(rand).padStart(8, '0')}`)
}
