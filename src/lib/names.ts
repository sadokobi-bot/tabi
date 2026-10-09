const words = (text: string) =>
  new Set(
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  )

/** Share of words the two names have in common (0–1). */
export function nameMatch(a: string, b: string): number {
  const x = words(a)
  const y = words(b)
  const shared = [...x].filter((w) => y.has(w)).length
  return shared / (new Set([...x, ...y]).size || 1)
}

/** Words that say what a place is or where, not which one it is. */
const GENERIC = new Set([
  'restaurant',
  'cafe',
  'café',
  'coffee',
  'shop',
  'store',
  'the',
  'and',
  'of',
  'no',
  'tokyo',
  'kyoto',
  'osaka',
  'japan',
  'branch',
  'main',
  'japanese',
  'temple',
  'shrine',
  'street',
  'dori',
  'shopping',
])

/**
 * The same place by name: most of the shorter name's own words appear in the other ("Meiji Jingu" and
 * "Meiji Jingu Shrine" yes; "Sushi Zanmai" and "Sushi Dai" no), or one is the other run together
 * ("Kinkaku-ji" and "Kinkakuji").
 */
export function sameName(a: string, b: string): boolean {
  const x = [...words(a)].filter((w) => !GENERIC.has(w))
  const y = [...words(b)].filter((w) => !GENERIC.has(w))
  if (x.length === 0 || y.length === 0) return false
  const shared = x.filter((w) => y.includes(w)).length
  if (shared >= 1 && shared / Math.min(x.length, y.length) >= 0.6) return true
  const [short, long] = [x.join(''), y.join('')].sort((p, q) => p.length - q.length) as [string, string]
  return short.length >= 5 && long.includes(short)
}
