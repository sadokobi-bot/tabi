import clsx from 'clsx'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/** wave: greeting; eat: idle, slurping ramen; cover: a password is being typed; peek: the password is shown. */
export type CatMood = 'wave' | 'eat' | 'cover' | 'peek'

type Frame = 'eat-1' | 'eat-2' | 'eat-3' | 'wave' | 'cover'
const FRAMES: Frame[] = ['eat-1', 'eat-2', 'eat-3', 'wave', 'cover']

// The eating flipbook: a look up, then two slurps. Frame and how long it stays, in ms.
const SLURP: [Frame, number][] = [
  ['eat-1', 1400],
  ['eat-2', 220],
  ['eat-3', 220],
  ['eat-2', 220],
  ['eat-3', 220],
  ['eat-2', 260],
]

const POSE: Record<CatMood, { rotate: number; x: number }> = {
  wave: { rotate: 0, x: 0 },
  eat: { rotate: 0, x: 0 },
  cover: { rotate: 0, x: 0 },
  // Back from behind its paws with a curious tilt.
  peek: { rotate: 8, x: -4 },
}

function useSlurp(active: boolean): Frame {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active || reduceMotion) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % SLURP.length), SLURP[index]![1])
    return () => clearTimeout(timer)
  }, [active, reduceMotion, index])
  useEffect(() => {
    if (!active) setIndex(0)
  }, [active])
  return SLURP[index]![0]
}

/**
 * The sign-up guide: an illustrated cat (frames in public/mascot/). It waves hello, slurps ramen
 * while waiting, covers its eyes while a password is typed, peeks when the password is shown, and
 * hops when tapped. All frames sit stacked in the DOM, so switching never waits on a download.
 */
export function CatMascot({ mood, className }: { mood: CatMood; className?: string }) {
  const hop = useAnimationControls()
  const pop = useAnimationControls()
  const eating = useSlurp(mood === 'eat')
  const frame: Frame = mood === 'eat' ? eating : mood === 'cover' ? 'cover' : 'wave'

  // A little squash when it changes pose, so the switch reads as a movement, not a cut.
  useEffect(() => {
    void pop.start({ scale: [0.92, 1.04, 1], transition: { duration: 0.35, ease: 'easeOut' } })
  }, [mood, pop])

  return (
    <motion.div
      role="img"
      aria-label="חתול מצויר"
      className={clsx('relative select-none', className)}
      animate={POSE[mood]}
      style={{ originY: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      whileTap={{ scale: 0.92 }}
      onTap={() => void hop.start({ y: [0, -26, 0], transition: { duration: 0.5, ease: 'easeOut' } })}
    >
      <motion.div animate={hop} className="size-full">
        <motion.div animate={pop} className="size-full" style={{ originY: 1 }}>
          {/* Idle life: a slow bob and a breath; while waving, a friendly sway. */}
          <motion.div
            className="relative size-full"
            style={{ originY: 1 }}
            animate={mood === 'wave' ? { rotate: [0, -4, 0, 4, 0], y: 0, scaleY: 1 } : { rotate: 0, y: [0, -4, 0], scaleY: [1, 1.025, 1] }}
            transition={{ duration: mood === 'wave' ? 1.6 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {FRAMES.map((f) => (
              <img
                key={f}
                src={`${import.meta.env.BASE_URL}mascot/${f}.png`}
                alt=""
                draggable={false}
                decoding="async"
                className={clsx('absolute inset-0 size-full object-contain', f !== frame && 'opacity-0')}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
