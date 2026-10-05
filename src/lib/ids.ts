/** Uniformly random string over `alphabet` (rejection sampling avoids modulo bias). */
function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length)
  let out = ''
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length]
    }
  }
  return out
}

/** Random URL-safe id (Firestore-style length). */
export function newId(length = 20): string {
  return randomString('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', length)
}

/** Human-friendly invite code without look-alike characters (0/O, 1/I/L): 31^8 ≈ 8.5·10^11 codes. */
export function newInviteCode(): string {
  return randomString('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8)
}

export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
