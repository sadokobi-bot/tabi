import clsx from 'clsx'
import { motion, type Transition, type Variant } from 'motion/react'

const EASE: Transition['ease'] = [0.22, 1, 0.36, 1]
const at = (delay: number, duration = 0.55): Transition => ({
  delay,
  duration,
  ease: EASE,
})

/** Lets SVG parts scale from their own edges (pillars grow up, beams spread from the middle). */
const BOX = { transformBox: 'fill-box' } as const

/**
 * The brand scene: a rising sun with the app icon's torii cut out of it. The gate takes the
 * page color, so it reads as a silhouette in light and dark mode. With `intro` the sun rises
 * and the gate assembles itself (launch screen); otherwise it renders finished.
 */
export function SunGate({ intro = false, className }: { intro?: boolean; className?: string }) {
  const initial = intro ? 'hidden' : false
  const part = (hidden: Variant, delay: number, duration?: number) => ({
    initial,
    animate: 'shown',
    variants: {
      hidden,
      shown: { opacity: 1, x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1 },
    },
    transition: at(delay, duration),
  })

  return (
    <svg viewBox="0 0 240 240" aria-hidden className={clsx('overflow-visible', className)}>
      <defs>
        <radialGradient id="sun-gate-sun" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ff9a6e" />
          <stop offset="0.55" stopColor="#e85a36" />
          <stop offset="1" stopColor="#b8341e" />
        </radialGradient>
      </defs>

      <motion.circle
        cx="120"
        cy="122"
        r="104"
        fill="url(#sun-gate-sun)"
        style={{ ...BOX, originX: 0.5, originY: 0.5 }}
        {...part({ opacity: 0, y: 36, scale: 0.82 }, 0, 0.9)}
      />

      {/* Same gate as public/icon.svg, scaled into the sun. */}
      <g className="fill-bg" transform="translate(120 64) scale(0.45) translate(-256 -104)">
        <motion.g style={{ ...BOX, originY: 1 }} {...part({ scaleY: 0 }, 0.35)}>
          <path d="M166 176 H198 L204 414 H158 Z" />
          <rect x="153" y="398" width="56" height="18" rx="3" />
        </motion.g>
        <motion.g style={{ ...BOX, originY: 1 }} {...part({ scaleY: 0 }, 0.43)}>
          <path d="M314 176 H346 L354 414 H308 Z" />
          <rect x="303" y="398" width="56" height="18" rx="3" />
        </motion.g>
        <motion.rect x="100" y="228" width="312" height="22" rx="4" style={{ ...BOX, originX: 0.5 }} {...part({ scaleX: 0 }, 0.7, 0.45)} />
        <motion.rect x="243" y="184" width="26" height="46" rx="2" style={{ ...BOX, originY: 1 }} {...part({ scaleY: 0 }, 0.82, 0.35)} />
        <motion.path
          d="M114 152 C180 172 332 172 398 152 L396 170 C332 190 180 190 116 170 Z"
          style={{ ...BOX, originX: 0.5 }}
          {...part({ opacity: 0, scaleX: 0.6 }, 0.88, 0.45)}
        />
        <motion.path d="M74 104 C150 136 362 136 438 104 L430 138 C358 164 154 164 82 138 Z" {...part({ opacity: 0, y: -40 }, 0.98, 0.6)} />
      </g>
    </svg>
  )
}
