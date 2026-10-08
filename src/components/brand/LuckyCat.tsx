import clsx from 'clsx'
import { motion, type Transition } from 'motion/react'

export type CatMood = 'wave' | 'cover' | 'peek'

const INK = '#3b2a22'
const FUR = '#fffaf3'
const PINK = '#f6a9b5'
const GOLD = '#e8b33a'
const SPRING: Transition = { type: 'spring', stiffness: 260, damping: 18 }

/** Where each paw sits (its center), per mood. The raised paw waves; covering puts both over the eyes. */
const PAWS: Record<CatMood, { raised: { x: number; y: number }; resting: { x: number; y: number } }> = {
  wave: { raised: { x: 30, y: 46 }, resting: { x: 96, y: 112 } },
  cover: { raised: { x: 56, y: 60 }, resting: { x: 84, y: 60 } },
  peek: { raised: { x: 50, y: 82 }, resting: { x: 84, y: 60 } },
}

/**
 * Maneki-neko, the Japanese beckoning cat, guiding sign-up: it waves hello, and covers its eyes
 * (politely) while a password is typed, peeking when the password is shown. Pure SVG + Motion.
 */
export function LuckyCat({ mood = 'wave', className }: { mood?: CatMood; className?: string }) {
  const paws = PAWS[mood]

  return (
    <svg viewBox="0 0 140 140" aria-hidden className={clsx('overflow-visible', className)}>
      {/* A gentle bob, so it never looks frozen */}
      <motion.g animate={{ y: [0, -2.5, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}>
        <ellipse cx="70" cy="131" rx="38" ry="5" fill="#000" opacity="0.14" />

        {/* Body */}
        <path d="M34 129 C28 102 36 80 70 80 C104 80 112 102 106 129 Z" fill={FUR} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="70" cy="112" rx="18" ry="13" fill="#000" opacity="0.04" />

        {/* Koban coin, held by the resting paw while waving */}
        <motion.g animate={{ opacity: mood === 'wave' ? 1 : 0, y: mood === 'wave' ? 0 : 6 }} transition={{ duration: 0.25 }}>
          <ellipse cx="100" cy="104" rx="11" ry="15" fill={GOLD} stroke={INK} strokeWidth="2" />
          <path d="M95 98 H105 M95 104 H105 M95 110 H105" stroke={INK} strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        </motion.g>

        {/* Ears (behind the head) */}
        <path d="M38 44 L42 13 L64 30 Z" fill={FUR} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M44 36 L46 21 L57 30 Z" fill={PINK} />
        <path d="M102 44 L98 13 L76 30 Z" fill={FUR} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M96 36 L94 21 L83 30 Z" fill={PINK} />

        {/* Head with a calico patch */}
        <ellipse cx="70" cy="58" rx="37" ry="32" fill={FUR} stroke={INK} strokeWidth="2.5" />
        <path d="M78 28 C92 28 103 38 106 50 C96 50 86 44 80 36 Z" fill="#f2a65a" opacity="0.85" />

        {/* Eyes: blink every few seconds */}
        <motion.g
          style={{ transformBox: 'fill-box', originY: 0.5 }}
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}
        >
          <ellipse cx="56" cy="58" rx="3.6" ry="4.6" fill={INK} />
          <ellipse cx="84" cy="58" rx="3.6" ry="4.6" fill={INK} />
          <circle cx="57.3" cy="56.4" r="1.2" fill="#fff" />
          <circle cx="85.3" cy="56.4" r="1.2" fill="#fff" />
        </motion.g>

        {/* Cheeks, nose, mouth, whiskers */}
        <circle cx="47" cy="68" r="5.5" fill={PINK} opacity="0.55" />
        <circle cx="93" cy="68" r="5.5" fill={PINK} opacity="0.55" />
        <path d="M67 64 H73 L70 67.5 Z" fill="#e57d8f" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        <path d="M64 70 Q67 74 70 70 Q73 74 76 70" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path
          d="M40 64 L28 61 M40 68 L27 69 M100 64 L112 61 M100 68 L113 69"
          stroke={INK}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Red collar and a gold bell */}
        <path d="M42 86 Q70 97 98 86 L99 93 Q70 104 41 93 Z" fill="#cc4329" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="70" cy="99" r="6" fill={GOLD} stroke={INK} strokeWidth="2" />
        <path d="M66 99 H74" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />

        {/* Resting paw (holds the coin; covers the left eye) */}
        <motion.g initial={false} animate={{ x: paws.resting.x, y: paws.resting.y }} transition={SPRING}>
          <ellipse cx="0" cy="0" rx="11" ry="12" fill={FUR} stroke={INK} strokeWidth="2.5" />
          <path d="M-4 5 Q0 8 4 5" stroke={PINK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* Raised paw: waves while greeting; covers the right eye or peeks below it */}
        <motion.g initial={false} animate={{ x: paws.raised.x, y: paws.raised.y }} transition={SPRING}>
          <motion.g
            style={{ transformBox: 'fill-box', originX: 0.5, originY: 1 }}
            animate={mood === 'wave' ? { rotate: [-14, 16, -14] } : { rotate: 0 }}
            transition={mood === 'wave' ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
          >
            <ellipse cx="0" cy="0" rx="11" ry="12.5" fill={FUR} stroke={INK} strokeWidth="2.5" />
            <path d="M-5 -3 V-8 M0 -4 V-10 M5 -3 V-8" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
            <circle cx="0" cy="3" r="3.2" fill={PINK} />
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  )
}
