import { useEffect, type RefObject } from 'react'
import { haptic } from '@/lib/haptics'

/** Pull distance (px, after resistance) that triggers a refresh on release. */
const THRESHOLD = 72
const MAX_PULL = 120
/** Where the content rests while the app reloads. */
const HOLD = 56
const SETTLE = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)'

/**
 * iOS-style pull to refresh for a scroll container: pull down while at the top, release past the
 * threshold and the app reloads. `content` moves with the finger; `indicator` shows the progress
 * (its `data-state` is "pull", "ready" or "refreshing"). Home-screen apps on iOS have no native one.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const scroller = scrollRef.current
    const content = contentRef.current
    const indicator = indicatorRef.current
    if (!enabled || !scroller || !content || !indicator) return

    let startY: number | null = null
    let distance = 0
    let ready = false
    let refreshing = false

    const paint = (value: number, animate: boolean) => {
      const transition = animate ? SETTLE : 'none'
      content.style.transition = transition
      indicator.style.transition = animate ? `${SETTLE}, opacity 0.2s` : 'none'
      content.style.transform = value ? `translateY(${value}px)` : ''
      indicator.style.transform = `translateY(${value - 44}px) rotate(${(value / THRESHOLD) * 270}deg)`
      indicator.style.opacity = String(Math.min(1, value / 32))
    }

    const onStart = (event: TouchEvent) => {
      if (refreshing || event.touches.length !== 1 || scroller.scrollTop > 0) return
      // Drag handles (trip board) own their vertical gestures.
      if ((event.target as Element | null)?.closest('.touch-none')) return
      startY = event.touches[0]!.clientY
      distance = 0
    }

    const onMove = (event: TouchEvent) => {
      if (startY == null) return
      const dy = event.touches[0]!.clientY - startY
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (distance) paint(0, false)
        distance = 0
        return
      }
      event.preventDefault()
      distance = Math.min(MAX_PULL, dy * 0.5)
      const nowReady = distance >= THRESHOLD
      if (nowReady !== ready) {
        ready = nowReady
        indicator.dataset.state = ready ? 'ready' : 'pull'
        if (ready) haptic()
      }
      paint(distance, false)
    }

    const onEnd = () => {
      if (startY == null) return
      startY = null
      if (ready) {
        refreshing = true
        indicator.dataset.state = 'refreshing'
        paint(HOLD, true)
        setTimeout(() => window.location.reload(), 450)
      } else {
        paint(0, true)
      }
      ready = false
      distance = 0
    }

    scroller.addEventListener('touchstart', onStart, { passive: true })
    scroller.addEventListener('touchmove', onMove, { passive: false })
    scroller.addEventListener('touchend', onEnd)
    scroller.addEventListener('touchcancel', onEnd)
    return () => {
      scroller.removeEventListener('touchstart', onStart)
      scroller.removeEventListener('touchmove', onMove)
      scroller.removeEventListener('touchend', onEnd)
      scroller.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef, contentRef, indicatorRef, enabled])
}
