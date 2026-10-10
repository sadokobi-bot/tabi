import clsx from 'clsx'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { TABS, emitTabReselect, type TabId } from '@/app/tabs'
import { haptic } from '@/lib/haptics'
import { useUnreadCount } from '@/store/chatRead'
import { useUi } from '@/store/ui'

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
  const unread = useUnreadCount()
  // While typing in the chat the bar slides away, so the input sits directly above the keyboard.
  const hidden = useUi((state) => state.composing) && activeId === 'chat'

  return (
    <motion.div
      initial={false}
      // Hidden with visibility, not `inert`: changing inert while the chat input has focus risks iOS dropping the keyboard.
      animate={hidden ? { y: '160%', opacity: 0, transitionEnd: { visibility: 'hidden' } } : { y: 0, opacity: 1, visibility: 'visible' }}
      transition={PILL_SPRING}
      aria-hidden={hidden || undefined}
      className="pointer-events-none fixed inset-x-0 bottom-(--tabbar-bottom) z-40 flex justify-center px-4"
    >
      <nav
        aria-label="ניווט ראשי"
        className="glass pointer-events-auto flex h-(--tabbar-height) w-full max-w-sm gap-1 lg:max-w-md rounded-card p-1.5 select-none"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeId
          const Icon = tab.icon
          const badge = tab.id === 'chat' && !isActive ? unread : 0

          return (
            <Link
              key={tab.id}
              to={tab.path}
              replace
              aria-current={isActive ? 'page' : undefined}
              aria-label={badge ? `${tab.label}, ${badge === 1 ? 'הודעה חדשה אחת' : `${badge} הודעות חדשות`}` : undefined}
              onClick={(event) => {
                haptic()
                if (isActive) {
                  event.preventDefault()
                  emitTabReselect(tab.id)
                }
              }}
              className={clsx(
                'relative flex-1 rounded-control outline-none',
                'focus-visible:ring-2 focus-visible:ring-accent/60',
                isActive ? 'text-fg' : 'text-muted transition-colors hover:text-fg',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="tabbar-active-pill"
                  aria-hidden
                  transition={PILL_SPRING}
                  className="absolute inset-0 rounded-control bg-accent/12"
                />
              )}

              {/* Fills the whole tab so every press gets the squish feedback. */}
              <motion.span
                whileTap={{ scale: 0.9 }}
                transition={PRESS_SPRING}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              >
                <motion.span animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }} transition={PRESS_SPRING} className="relative">
                  <Icon aria-hidden className={clsx('size-[22px]', isActive && 'text-accent')} strokeWidth={isActive ? 2.25 : 1.75} />
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -end-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-fill px-1 text-[10px] leading-none font-bold text-accent-fg tabular-nums"
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </motion.span>
                <span className={clsx('text-[11px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>{tab.label}</span>
              </motion.span>
            </Link>
          )
        })}
      </nav>
    </motion.div>
  )
}
