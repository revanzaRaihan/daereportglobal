/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) Generator.
 * 26 characters, Crockford's Base32, URL-safe, Anti-IDOR identifier.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ENCODING_LEN = ENCODING.length

export function generateUlid(timestamp: number = Date.now()): string {
  // 1. Time component (10 characters, 48 bits)
  let timeStr = ''
  let time = timestamp
  for (let i = 9; i >= 0; i--) {
    const mod = time % ENCODING_LEN
    timeStr = ENCODING.charAt(mod) + timeStr
    time = Math.floor(time / ENCODING_LEN)
  }

  // 2. Random component (16 characters, 80 bits)
  let randStr = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(16)
    crypto.getRandomValues(randomBytes)
    for (let i = 0; i < 16; i++) {
      randStr += ENCODING.charAt(randomBytes[i] % ENCODING_LEN)
    }
  } else {
    // Fallback for environments where crypto is unavailable
    for (let i = 0; i < 16; i++) {
      const rand = Math.floor(Math.random() * ENCODING_LEN)
      randStr += ENCODING.charAt(rand)
    }
  }

  return timeStr + randStr
}

export function isValidUlid(uid: string): boolean {
  if (typeof uid !== 'string' || uid.length !== 26) return false
  return /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i.test(uid)
}

/**
 * Generates a revocable, cryptographic share token for public zero-login LMS links (/learn/{share_token}).
 * Length: ~52 characters (prefix 'lrn_' + 48 hex characters).
 */
export function generateShareToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const randomHex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    return `lrn_${randomHex}`
  }
  return `lrn_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`
}

