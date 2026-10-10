import { useEffect, useState } from 'react'
import type { Viewport } from '@/components/map/types'
import type { CategoryId } from '@/data/types'
import { boundsKey } from '@/lib/geo'
import type { Poi, PoiProvider } from './poi'

export interface AreaState {
  status: 'idle' | 'loading' | 'ok' | 'zoom-in' | 'error'
  pois: Poi[]
}

/**
 * Fetches recommended places for the visible map bounds whenever the viewport settles
 * (debounced, cancelling stale requests). Tiny pans reuse the same coarse bounds key.
 */
export function useAreaRecommendations(provider: PoiProvider | null, viewport: Viewport | null, categories: CategoryId[]): AreaState {
  const [state, setState] = useState<AreaState>({ status: 'idle', pois: [] })
  const categoriesKey = categories.join(',')
  const areaKey = viewport ? boundsKey(viewport.bounds) : null

  useEffect(() => {
    if (!provider || !viewport || categories.length === 0) {
      setState({ status: 'idle', pois: [] })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState((prev) => ({ status: 'loading', pois: prev.pois }))
      provider.searchArea(viewport.bounds, categories, controller.signal).then(
        (result) => {
          if (controller.signal.aborted) return
          setState(result.status === 'ok' ? { status: 'ok', pois: result.pois } : { status: 'zoom-in', pois: [] })
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          console.warn('[recommendations]', error)
          setState((prev) => ({ status: 'error', pois: prev.pois }))
        },
      )
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // Keyed on the coarse area + category set (not the viewport object) so tiny pans don't refetch.
  }, [provider, areaKey, categoriesKey])

  return state
}
