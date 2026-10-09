/**
 * Username rules + mapping to the synthetic e-mail used by Firebase Auth.
 * Users only ever see "username + password"; no e-mail, no verification codes.
 */

/** Hebrew or English letters/digits; may contain space . _ - after the first character. */
const USERNAME_PATTERN = /^[a-zA-Z0-9א-ת][a-zA-Z0-9א-ת ._-]*$/
export const USERNAME_MIN = 2
export const USERNAME_MAX = 16

const EMAIL_DOMAIN = 'users.tabi.example'

export type UsernameCheck = { ok: true; display: string; key: string } | { ok: false; reason: string }

export function checkUsername(raw: string): UsernameCheck {
  const display = raw.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (display.length < USERNAME_MIN) return { ok: false, reason: `שם המשתמש צריך לכלול לפחות ${USERNAME_MIN} תווים` }
  if (display.length > USERNAME_MAX) return { ok: false, reason: `שם המשתמש יכול לכלול עד ${USERNAME_MAX} תווים` }
  if (!USERNAME_PATTERN.test(display)) {
    return { ok: false, reason: 'אפשר להשתמש באותיות בעברית או באנגלית, ספרות, רווח, נקודה, מקף וקו תחתון' }
  }
  return { ok: true, display, key: display.toLowerCase() }
}

/* RFC 4648 base32, lowercase, no padding: case-insensitive, so it survives Firebase's e-mail lowercasing. */
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'

function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(text: string): Uint8Array {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of text) {
    const index = BASE32.indexOf(char)
    if (index === -1) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** Username key → deterministic e-mail. ASCII names stay readable in the Firebase console. */
export function usernameToEmail(key: string): string {
  const local = /^[a-z0-9_-]+$/.test(key) ? key : `x-${base32Encode(new TextEncoder().encode(key))}`
  return `${local}@${EMAIL_DOMAIN}`
}

/** The account's own e-mail is the made-up one (no recovery e-mail added). */
export function isUsernameEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith(`@${EMAIL_DOMAIN}`)
}

export function emailToUsername(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local.startsWith('x-') ? new TextDecoder().decode(base32Decode(local.slice(2))) : local
}
