import { useMemo, type CSSProperties } from 'react'

/** Small seeded PRNG, so the petals keep the same paths across renders. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One notched cherry-blossom petal. */
const PETAL = 'M10 1 C6 1 2 5 2 11 C2 16 6 19 10 19 C14 19 18 16 18 11 C18 5 14 1 12 3 L10 5 Z'

/**
 * Cherry-blossom petals drifting down behind the sign-in header. Pure CSS animation on
 * transforms (cheap to composite); hidden for "reduce motion" (see index.css).
 */
export function SakuraDrift({ count = 14 }: { count?: number }) {
  const petals = useMemo(() => {
    const random = seeded(7)
    return Array.from({ length: count }, (_, i) => {
      const size = 9 + random() * 9
      return {
        id: i,
        style: {
          left: `${random() * 100}%`,
          width: size,
          height: size,
          '--fall': `${11 + random() * 8}s`,
          '--sway': `${2.6 + random() * 2}s`,
          '--delay': `${random() * 10}s`,
          '--dx': `${(random() - 0.3) * 160}px`,
          '--spin': `${(random() > 0.5 ? 1 : -1) * (180 + random() * 360)}deg`,
          '--alpha': 0.45 + random() * 0.45,
        } as CSSProperties,
      }
    })
  }, [count])

  return (
    <div aria-hidden className="sakura pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((petal) => (
        <span key={petal.id} className="sakura-petal" style={petal.style}>
          <svg viewBox="0 0 20 20" className="sakura-flutter">
            <path d={PETAL} />
          </svg>
        </span>
      ))}
    </div>
  )
}
