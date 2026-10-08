import { useEffect, useState } from 'react'
import { motion, type Transition } from 'motion/react'

/** The intro plays once per launch; the splash re-mounts between loading steps and should not restart it. */
let introPlayed = false

const EASE: Transition['ease'] = [0.22, 1, 0.36, 1]
const at = (delay: number, duration = 0.55): Transition => ({ delay, duration, ease: EASE })

/** Lets SVG parts scale from their own edges (pillars grow up, beams spread from the middle). */
const SVG_BOX = { transformBox: 'fill-box' } as const

/**
 * Full-screen launch state while the session / trip data load: a sun rises behind a torii
 * that assembles itself, then the wordmark and a quiet progress line.
 */
export function SplashScreen({ message, failed = false }: { message?: string; failed?: boolean }) {
  const [intro] = useState(() => !introPlayed)
  useEffect(() => {
    introPlayed = true
  }, [])
  const initial = intro ? 'hidden' : false

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-8 text-center">
      {/* Warm haze behind the sun */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[34rem] -translate-x-1/2 -translate-y-[62%] rounded-full bg-accent/14 blur-3xl"
        initial={intro ? { opacity: 0 } : false}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 240 240" aria-hidden className="size-44 overflow-visible">
          <defs>
            <radialGradient id="splash-sun" cx="0.38" cy="0.32" r="0.75">
              <stop offset="0" stopColor="#ff9a6e" />
              <stop offset="0.55" stopColor="#e85a36" />
              <stop offset="1" stopColor="#b8341e" />
            </radialGradient>
          </defs>

          <motion.circle
            cx="120"
            cy="122"
            r="104"
            fill="url(#splash-sun)"
            style={{ ...SVG_BOX, originX: 0.5, originY: 0.5 }}
            initial={initial}
            animate="shown"
            variants={{ hidden: { opacity: 0, y: 36, scale: 0.82 }, shown: { opacity: 1, y: 0, scale: 1 } }}
            transition={at(0, 0.9)}
          />

          {/* The gate is cut from the page color, so it reads as a silhouette in light and dark mode. */}
          <g className="fill-bg">
            {[74, 152].map((x, i) => (
              <motion.rect
                key={x}
                x={x}
                y="86"
                width="14"
                height="112"
                rx="2"
                style={{ ...SVG_BOX, originY: 1 }}
                initial={initial}
                animate="shown"
                variants={{ hidden: { scaleY: 0 }, shown: { scaleY: 1 } }}
                transition={at(0.35 + i * 0.08)}
              />
            ))}
            <motion.rect
              x="58"
              y="114"
              width="124"
              height="11"
              rx="2"
              style={{ ...SVG_BOX, originX: 0.5 }}
              initial={initial}
              animate="shown"
              variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
              transition={at(0.7, 0.45)}
            />
            <motion.rect
              x="115"
              y="90"
              width="10"
              height="26"
              style={{ ...SVG_BOX, originY: 1 }}
              initial={initial}
              animate="shown"
              variants={{ hidden: { scaleY: 0 }, shown: { scaleY: 1 } }}
              transition={at(0.85, 0.35)}
            />
            <motion.path
              d="M34 62 Q120 80 206 62 L202 80 Q120 96 38 80 Z"
              initial={initial}
              animate="shown"
              variants={{ hidden: { opacity: 0, y: -18 }, shown: { opacity: 1, y: 0 } }}
              transition={at(0.95, 0.6)}
            />
          </g>
        </svg>

        <motion.div
          initial={intro ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={at(1.15, 0.6)}
          className="mt-7"
        >
          <p className="text-[2rem] leading-none font-bold tracking-tight">
            Tabi <span className="font-medium text-accent">旅</span>
          </p>
          <p className="mt-2 text-sm text-muted">הטיול שלנו ליפן</p>
        </motion.div>

        <motion.div
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={at(1.4, 0.5)}
          className="mt-8 flex flex-col items-center gap-3"
        >
          {!failed && (
            <div aria-hidden className="h-[3px] w-28 overflow-hidden rounded-full bg-fg/10">
              <motion.div
                className="h-full w-1/2 rounded-full bg-accent-fill"
                animate={{ x: ['-110%', '210%'] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
          <p role="status" className={failed ? 'max-w-xs text-sm text-fg' : 'max-w-xs text-xs text-muted'}>
            {message ?? 'טוענים את הטיול…'}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
