import clsx from 'clsx'
import { motion, useAnimationControls } from 'motion/react'
import { useEffect } from 'react'
import { FrameLoop, ONI_CLIPS, oniStill } from './FrameLoop'

/** wave: greeting; eat: idle (waiting); cover: a password is being typed; peek: the password is shown. */
export type CatMood = 'wave' | 'eat' | 'cover' | 'peek'

/**
 * The sign-up guide, Oni the onigiri: waves hello on a loop, covers its eyes while a password is
 * typed, peeks when the password is shown, and hops when tapped. The clip and both stills sit
 * stacked, so switching never waits on a download.
 */
export function CatMascot({ mood, className }: { mood: CatMood; className?: string }) {
  const hop = useAnimationControls()
  const pop = useAnimationControls()
  const still = mood === 'cover' || mood === 'peek' ? mood : null

  // A little squash when it changes pose, so the switch reads as a movement, not a cut.
  useEffect(() => {
    void pop.start({ scale: [0.94, 1.03, 1], transition: { duration: 0.35, ease: 'easeOut' } })
  }, [still, pop])

  return (
    <motion.div
      role="img"
      aria-label="אוני, האוניגירי של Tabi"
      className={clsx('relative select-none', className)}
      whileTap={{ scale: 0.92 }}
      onTap={() => void hop.start({ y: [0, -26, 0], transition: { duration: 0.5, ease: 'easeOut' } })}
    >
      <motion.div animate={hop} className="size-full">
        <motion.div animate={pop} className="relative size-full" style={{ originY: 1 }}>
          <FrameLoop clip={ONI_CLIPS.hello} className={clsx('absolute inset-0 size-full', still && 'opacity-0')} />
          {(['cover', 'peek'] as const).map((pose) => (
            <img
              key={pose}
              src={oniStill(pose)}
              alt=""
              draggable={false}
              decoding="async"
              className={clsx('absolute inset-0 size-full object-contain', still !== pose && 'opacity-0')}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
