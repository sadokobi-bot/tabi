import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { motion, useReducedMotion } from 'motion/react'

/** The cat planning the trip: think, draw the route, think again… (frame and how long it stays, ms). */
const WORKING: [number, number][] = [
  [1, 1500],
  [2, 650],
  [3, 650],
  [2, 650],
  [3, 650],
  [2, 650],
]

export type CreatorStage = 'working' | 'almost' | 'done'

/**
 * The trip-creator cat, in five frames: thinking and drawing on the map while the AI works, holding
 * up the finished map near the end, and setting off with a backpack when the trip is ready.
 * Under it a dotted route is drawn along with the progress.
 */
export function TripCreatorCat({ stage, share }: { stage: CreatorStage; share: number }) {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (stage !== 'working' || reduceMotion) return
    const timer = setTimeout(() => setStep((s) => (s + 1) % WORKING.length), WORKING[step]![1])
    return () => clearTimeout(timer)
  }, [stage, step, reduceMotion])

  const frame = stage === 'done' ? 5 : stage === 'almost' ? 4 : WORKING[step]![0]
  const drawing = stage === 'working' && frame !== 1

  return (
    <div className="relative mx-auto h-72 w-80">
      {/* The route, drawn as the plan comes together. */}
      <svg aria-hidden viewBox="0 0 320 64" className="absolute inset-x-0 bottom-0 h-16 w-full overflow-visible text-accent">
        <path
          d="M16 40 C 75 6, 120 62, 165 32 S 265 10, 304 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 9"
          opacity={0.25}
        />
        <motion.path
          d="M16 40 C 75 6, 120 62, 165 32 S 265 10, 304 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.03, share) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          opacity={0.55}
        />
        {[16, 165, 304].map((x, index) => (
          <motion.circle
            key={x}
            cx={x}
            cy={[40, 32, 30][index]}
            r="5"
            fill="currentColor"
            initial={{ scale: 0 }}
            animate={{ scale: share >= index / 2 ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          />
        ))}
      </svg>

      <motion.div
        className="absolute inset-x-0 top-0 mx-auto size-64"
        style={{ originY: 1 }}
        animate={
          stage === 'done'
            ? { x: [0, 10, 0, 10, 0], y: [0, -8, 0, -8, 0], rotate: [0, 3, 0, 3, 0] }
            : stage === 'almost'
              ? { y: [0, -10, 0], rotate: 0, x: 0 }
              : drawing
                ? { rotate: [0, -1.5, 0, 1.5, 0], y: 0, x: 0 }
                : { y: [0, -3, 0], rotate: 0, x: 0 }
        }
        transition={
          stage === 'done'
            ? { duration: 1.2, ease: 'easeInOut' }
            : { duration: stage === 'almost' ? 0.9 : drawing ? 0.35 : 1.6, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <img
            key={n}
            src={`${import.meta.env.BASE_URL}mascot/creator-${n}.png`}
            alt=""
            aria-hidden
            draggable={false}
            className={clsx('absolute inset-0 size-full object-contain select-none', n !== frame && 'opacity-0')}
          />
        ))}
      </motion.div>

      {/* A few sparkles while it works. */}
      {stage !== 'done' &&
        [
          ['12%', '18%', 0],
          ['82%', '10%', 0.6],
          ['88%', '52%', 1.2],
        ].map(([left, top, delay]) => (
          <motion.span
            key={String(left)}
            aria-hidden
            className="absolute text-lg text-amber-400"
            style={{ left: left as string, top: top as string }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: delay as number }}
          >
            ✦
          </motion.span>
        ))}
    </div>
  )
}
