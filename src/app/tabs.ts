import { CalendarRange, Map as MapIcon, Sun, type LucideIcon } from 'lucide-react'

export type TabId = 'today' | 'map' | 'trip'

export interface TabConfig {
  id: TabId
  /** Route path. Sub-routes (e.g. /trip/day/4) keep their parent tab active. */
  path: string
  label: string
  icon: LucideIcon
  /** Edge-to-edge screens (the map) render without a scroll container or bottom padding. */
  fullBleed?: boolean
}

/** Single source of truth for the bottom navigation. Array order = tab bar order (right → left in RTL). */
export const TABS: readonly TabConfig[] = [
  { id: 'today', path: '/', label: 'היום', icon: Sun },
  { id: 'map', path: '/map', label: 'מפה', icon: MapIcon, fullBleed: true },
  { id: 'trip', path: '/trip', label: 'הטיול', icon: CalendarRange },
]

/** Index of the tab that owns `pathname`, or -1 for unknown routes. */
export function findTabIndex(pathname: string): number {
  const path = pathname.replace(/\/+$/, '') || '/'
  return TABS.findIndex((tab) =>
    tab.path === '/' ? path === '/' : path === tab.path || path.startsWith(`${tab.path}/`),
  )
}

/** Fired when the user taps the tab that is already active (scroll to top, re-center the map…). */
export const TAB_RESELECT_EVENT = 'tabbar:reselect'

export function emitTabReselect(tabId: TabId): void {
  window.dispatchEvent(new CustomEvent<TabId>(TAB_RESELECT_EVENT, { detail: tabId }))
}
