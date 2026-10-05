import { useEffect, useState } from 'react'
import type { PoiDetails, PoiProvider } from './poi'

export interface DetailsState {
  status: 'idle' | 'loading' | 'ok' | 'error'
  data: PoiDetails | null
}

/** Live Google details for a place (photos, rating, hours). Idle when there's no Google id/provider. */
export function usePlaceDetails(provider: PoiProvider | null, googlePlaceId: string | undefined): DetailsState {
  const [state, setState] = useState<DetailsState>({ status: 'idle', data: null })

  useEffect(() => {
    if (!provider || provider.id !== 'google' || !googlePlaceId) {
      setState({ status: 'idle', data: null })
      return
    }
    let cancelled = false
    setState({ status: 'loading', data: null })
    provider.details(googlePlaceId).then(
      (data) => !cancelled && setState({ status: 'ok', data }),
      () => !cancelled && setState({ status: 'error', data: null }),
    )
    return () => {
      cancelled = true
    }
  }, [provider, googlePlaceId])

  return state
}
