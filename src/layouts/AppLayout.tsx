import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { Navigate, useLocation } from 'react-router'
import { TABS, findTabIndex, type TabId } from '@/app/tabs'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { ScreenErrorBoundary } from '@/components/layout/ScreenErrorBoundary'
import { ScreenLoader } from '@/components/layout/ScreenLoader'
import { TabPanel } from '@/components/layout/TabPanel'
import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { PlaceSheet } from '@/components/place/PlaceSheet'
import { ProfileSheet } from '@/components/profile/ProfileSheet'
import TodayScreen from '@/screens/TodayScreen'

// "Today" is the landing screen, so it ships in the main bundle.
// Map (map engine) and Trip (drag & drop) are code-split and pre-warmed once the browser is idle.
const loadMapScreen = () => import('@/screens/MapScreen')
const loadTripScreen = () => import('@/screens/TripScreen')
const loadChatScreen = () => import('@/screens/ChatScreen')

const SCREENS: Record<TabId, ComponentType> = {
  today: TodayScreen,
  map: lazy(loadMapScreen),
  trip: lazy(loadTripScreen),
  chat: lazy(loadChatScreen),
}

/**
 * App shell: screens + floating tab bar + global sheets.
 *
 * Tabs are "keep-alive": a screen mounts the first time its tab is opened and then stays mounted,
 * hidden with `visibility` + `inert`. This preserves scroll positions and keeps the map instance
 * alive, so switching tabs never re-creates the map (every new Google map instance is a billable
 * "map load" and would reset the camera).
 */
export function AppLayout() {
  const { pathname } = useLocation()
  const activeIndex = findTabIndex(pathname)
  const activeTab = TABS[activeIndex]

  const [visited, setVisited] = useState<ReadonlySet<TabId>>(
    () => new Set(activeTab ? [activeTab.id] : []),
  )

  useEffect(() => {
    if (!activeTab) return
    setVisited((prev) => (prev.has(activeTab.id) ? prev : new Set(prev).add(activeTab.id)))
  }, [activeTab])

  // Warm up the code-split screens in the background so the first tab switch is instant.
  useEffect(() => {
    const warmUp = () => {
      void loadMapScreen()
      void loadTripScreen()
      void loadChatScreen()
    }
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(warmUp, { timeout: 4000 })
      return () => window.cancelIdleCallback(handle)
    }
    const timer = setTimeout(warmUp, 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!activeTab) return <Navigate to="/" replace />

  return (
    <div className="fixed inset-0 overflow-hidden">
      <AmbientBackground />
      <div aria-hidden className="status-blend absolute inset-x-0 top-0 h-28" />

      <main className="absolute inset-0">
        {TABS.map((tab, index) => {
          const Screen = SCREENS[tab.id]
          const isActive = index === activeIndex

          return (
            <TabPanel
              key={tab.id}
              tabId={tab.id}
              label={tab.label}
              isActive={isActive}
              position={Math.sign(index - activeIndex)}
              fullBleed={tab.fullBleed}
            >
              {(isActive || visited.has(tab.id)) && (
                <ScreenErrorBoundary>
                  <Suspense fallback={<ScreenLoader />}>
                    <Screen />
                  </Suspense>
                </ScreenErrorBoundary>
              )}
            </TabPanel>
          )
        })}
      </main>

      <BottomTabBar activeId={activeTab.id} />

      {/* Global overlays: place details (from the map, timeline, board) and profile / trip settings. */}
      <PlaceSheet />
      <ProfileSheet />
    </div>
  )
}
