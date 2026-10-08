import { useEffect, useState } from 'react'
import { motion, type Transition } from 'motion/react'
import { SunGate } from '@/components/brand/SunGate'

/** How long the intro takes to finish (the progress line is the last thing to appear). */
const INTRO_MS = 1900

/** When the intro started. It plays once per launch; the splash re-mounts between loading steps and should not restart it. */
let introStartedAt: number | null = null

/**
 * False until the launch intro has had time to play, so a fast load doesn't cut it off.
 * Data keeps loading underneath; this only holds back what replaces the splash.
 */
export function useIntroDone(): boolean {
  const remaining = () => (introStartedAt === null ? 0 : INTRO_MS - (performance.now() - introStartedAt))
  const [done, setDone] = useState(() => introStartedAt !== null && remaining() <= 0)
  useEffect(() => {
    if (done) return
    const timer = setTimeout(() => setDone(true), Math.max(0, remaining()))
    return () => clearTimeout(timer)
  }, [done])
  return done
}

const EASE: Transition['ease'] = [0.22, 1, 0.36, 1]
const at = (delay: number, duration = 0.55): Transition => ({
  delay,
  duration,
  ease: EASE,
})

/**
 * Full-screen launch state while the session / trip data load: the sun rises, the torii
 * assembles itself, then the wordmark and a quiet progress line. The sun is shared (layoutId)
 * with the sign-in screen, so it glides into place there.
 */
export function SplashScreen({ message, failed = false }: { message?: string; failed?: boolean }) {
  const [intro] = useState(() => {
    if (introStartedAt !== null) return false
    introStartedAt = performance.now()
    return true
  })

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden px-8 text-center">
      {/* Warm haze behind the sun */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[34rem] -translate-x-1/2 -translate-y-[62%] rounded-full bg-accent/14 blur-3xl"
        initial={intro ? { opacity: 0 } : false}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-col items-center">
        <motion.div layoutId="sun-gate" transition={{ duration: 0.7, ease: EASE }}>
          <SunGate intro={intro} className="size-44" />
        </motion.div>

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
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
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
