import { useEffect, useRef } from 'react'
import { TAB_RESELECT_EVENT, type TabId } from '@/app/tabs'

/** Runs `handler` when the user taps the tab bar item of an already-active tab. */
export function useTabReselect(tabId: TabId, handler: () => void, enabled = true): void {
  // Latest-ref pattern: the listener always calls the newest handler without re-subscribing.
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return

    const onReselect = (event: Event) => {
      if ((event as CustomEvent<TabId>).detail === tabId) handlerRef.current()
    }

    window.addEventListener(TAB_RESELECT_EVENT, onReselect)
    return () => window.removeEventListener(TAB_RESELECT_EVENT, onReselect)
  }, [tabId, enabled])
}
