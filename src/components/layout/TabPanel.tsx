import { useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { motion, type TargetAndTransition } from 'motion/react'
import { TabActiveContext } from '@/app/tabActive'
import type { TabId } from '@/app/tabs'
import { useTabReselect } from '@/hooks/useTabReselect'

/** How far (px) a screen travels horizontally while entering / leaving. */
const SHIFT_PX = 28
/** Later tabs sit toward the inline-end side: right in LTR, left in RTL. */
const INLINE_DIR = document.documentElement.dir === 'rtl' ? -1 : 1

const ACTIVE_POSE: TargetAndTransition = {
  x: 0,
  opacity: 1,
  scale: 1,
  visibility: 'visible',
  transition: {
    type: 'spring',
    stiffness: 380,
    damping: 38,
    mass: 0.8,
    opacity: { duration: 0.22, ease: 'easeOut' },
  },
}

/**
 * Hidden pose. `position` is -1 when this tab comes before the active one and +1 when after,
 * so screens always slide in from (and out toward) the side their tab sits on.
 */
function inactivePose(position: number): TargetAndTransition {
  return {
    x: position * SHIFT_PX * INLINE_DIR,
    opacity: 0,
    scale: 0.985,
    transition: { duration: 0.16, ease: 'easeIn' },
    transitionEnd: { visibility: 'hidden' },
  }
}

interface TabPanelProps {
  tabId: TabId
  label: string
  isActive: boolean
  /** Position relative to the active tab: -1 before, 0 active, 1 after. */
  position: number
  /** Edge-to-edge screens (the map): no scroll container, no tab-bar padding. */
  fullBleed?: boolean
  children: ReactNode
}

/** One keep-alive screen container. Animates between active and hidden poses. */
export function TabPanel({ tabId, label, isActive, position, fullBleed = false, children }: TabPanelProps) {
  const scrollRef = useRef<HTMLElement>(null)

  // iOS convention: tapping the active tab scrolls its screen back to the top.
  useTabReselect(tabId, () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), !fullBleed)

  return (
    <motion.section
      ref={scrollRef}
      id={`screen-${tabId}`}
      aria-label={label}
      inert={!isActive}
      initial={false}
      animate={isActive ? ACTIVE_POSE : inactivePose(position)}
      style={{ zIndex: isActive ? 1 : 0 }}
      className={clsx(
        'absolute inset-0',
        !isActive && 'pointer-events-none',
        fullBleed ? 'overflow-hidden' : 'overflow-y-auto overscroll-y-contain',
      )}
    >
      <TabActiveContext value={isActive}>
        {fullBleed ? children : <div className="pb-tabbar min-h-full">{children}</div>}
      </TabActiveContext>
    </motion.section>
  )
}
