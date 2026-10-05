import { useEffect, useState } from 'react'
import type { LatLng } from '@/data/types'

export interface GeoFix {
  location: LatLng
  /** Accuracy radius in meters. */
  accuracy: number
  heading: number | null
  timestamp: number
}

export type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'

export interface GeoState {
  status: GeoStatus
  fix: GeoFix | null
}

/**
 * Live device location (the "blue dot"). Watches only while `active`, so GPS
 * stops when the map tab is hidden and the battery is spared.
 */
export function useGeolocation(active: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'idle', fix: null })

  useEffect(() => {
    if (!active) return
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable', fix: null })
      return
    }

    setState((prev) => ({ ...prev, status: prev.fix ? 'ok' : 'locating' }))
    const watchId = navigator.geolocation.watchPosition(
      (position) =>
        setState({
          status: 'ok',
          fix: {
            location: { lat: position.coords.latitude, lng: position.coords.longitude },
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            timestamp: position.timestamp,
          },
        }),
      (error) =>
        setState((prev) => ({
          fix: prev.fix,
          status: error.code === error.PERMISSION_DENIED ? 'denied' : prev.fix ? 'ok' : 'unavailable',
        })),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [active])

  return state
}
