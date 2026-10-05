import clsx from 'clsx'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { TABS, emitTabReselect, type TabId } from '@/app/tabs'
import { haptic } from '@/lib/haptics'

const PRESS_SPRING = { type: 'spring', stiffness: 600, damping: 32 } as const
const PILL_SPRING = { type: 'spring', stiffness: 480, damping: 38 } as const

interface BottomTabBarProps {
  activeId: TabId
}

/**
 * Floating glass tab bar.
 * - A shared-layout "pill" (Motion `layoutId`) glides to the active tab.
 * - Tab switches use history.replace: like native tab bars, switching tabs doesn't grow the back stack.
 * - Tapping the already-active tab emits a reselect event (screens scroll to top, the map re-centers).
 */
export function BottomTabBar({ activeId }: BottomTabBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-(--tabbar-bottom) z-40 flex justify-center px-4">
      <nav
        aria-label="ניווט ראשי"
        className="glass pointer-events-auto flex h-(--tabbar-height) w-full max-w-sm gap-1 rounded-[1.75rem] p-1.5 select-none"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeId
          const Icon = tab.icon

          return (
            <Link
              key={tab.id}
              to={tab.path}
              replace
              aria-current={isActive ? 'page' : undefined}
              onClick={(event) => {
                haptic()
                if (isActive) {
                  event.preventDefault()
                  emitTabReselect(tab.id)
                }
              }}
              className={clsx(
                'relative flex-1 rounded-[1.375rem] outline-none',
                'focus-visible:ring-2 focus-visible:ring-accent/60',
                isActive ? 'text-fg' : 'text-muted transition-colors hover:text-fg',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="tabbar-active-pill"
                  aria-hidden
                  transition={PILL_SPRING}
                  className="absolute inset-0 rounded-[1.375rem] bg-accent/12"
                />
              )}

              {/* Fills the whole tab so every press gets the squish feedback. */}
              <motion.span
                whileTap={{ scale: 0.9 }}
                transition={PRESS_SPRING}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              >
                <motion.span
                  animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }}
                  transition={PRESS_SPRING}
                >
                  <Icon
                    aria-hidden
                    className={clsx('size-[22px]', isActive && 'text-accent')}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                </motion.span>
                <span className={clsx('text-[11px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>
                  {tab.label}
                </span>
              </motion.span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
