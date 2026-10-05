import { useMemo } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { hasGoogleMaps } from '@/config/env'
import { createGoogleProvider } from './googlePlaces'
import { osmProvider } from './osmPlaces'
import type { PoiProvider } from './poi'

function useGoogleProvider(): PoiProvider | null {
  const places = useMapsLibrary('places')
  return useMemo(() => (places ? createGoogleProvider(places) : null), [places])
}

const useOsmProvider = (): PoiProvider => osmProvider

/**
 * Google Places when a Maps key is configured, otherwise free OpenStreetMap data.
 * `hasGoogleMaps` is a build-time constant, so the hook choice never changes between renders.
 * Returns null while the Google library is still loading.
 */
export const usePoiProvider: () => PoiProvider | null = hasGoogleMaps ? useGoogleProvider : useOsmProvider
