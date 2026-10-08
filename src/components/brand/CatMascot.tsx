import clsx from 'clsx'
import { motion, useAnimationControls } from 'motion/react'

/** wave: greeting; cover: a password is being typed (it looks away); peek: the password is shown. */
export type CatMood = 'wave' | 'cover' | 'peek'

const POSE: Record<CatMood, { scaleX: number; rotate: number; x: number }> = {
  wave: { scaleX: 1, rotate: 0, x: 0 },
  // Turns its back politely: mirrored and leaning away.
  cover: { scaleX: -1, rotate: -7, x: 6 },
  // Turns back with a curious tilt.
  peek: { scaleX: 1, rotate: 9, x: -4 },
}

/**
 * The sign-up guide: the ramen-eating cat illustration (public/mascot-cat.png, cut out of its
 * background). It breathes and bobs, looks away while a password is typed, peeks when the password
 * is shown, and hops when tapped.
 */
export function CatMascot({ mood, className }: { mood: CatMood; className?: string }) {
  const hop = useAnimationControls()

  return (
    <motion.div
      role="img"
      aria-label="חתול אוכל ראמן"
      className={clsx('relative select-none', className)}
      animate={POSE[mood]}
      transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      whileTap={{ scale: 0.92 }}
      onTap={() => void hop.start({ y: [0, -26, 0], transition: { duration: 0.5, ease: 'easeOut' } })}
    >
      <motion.div animate={hop} className="size-full">
        {/* Idle life: a slow bob and a breath, so it never looks like a sticker */}
        <motion.img
          src={`${import.meta.env.BASE_URL}mascot-cat.png`}
          alt=""
          draggable={false}
          className="size-full object-contain"
          style={{ originY: 1 }}
          animate={{ y: [0, -4, 0], scaleY: [1, 1.025, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  )
}
