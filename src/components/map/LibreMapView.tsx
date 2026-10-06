import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Map as LibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre v6 is ESM-only; bundlers must hand it a self-contained worker (see MapLibre's Vite guide).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { CategoryId, LatLng } from '@/data/types'
import { useLatest } from '@/hooks/useLatest'
import { circlePolygon } from '@/lib/geo'
import { MarkerPin, UserDot } from './MarkerPin'
import type { MapViewProps } from './types'

/**
 * Free map engine: MapLibre GL + OpenFreeMap vector tiles (OpenStreetMap data, no API key).
 * Used until a Google Maps key is configured. Fully interactive: pan, zoom, rotate, tilt.
 */

setWorkerUrl(workerUrl)

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'
const ACCURACY_SOURCE = 'user-accuracy'

/** MapLibre uses 512px tiles, so its zoom is one level below Google's for the same scale. */
const toLibreZoom = (googleZoom: number) => googleZoom - 1
const toGoogleZoom = (libreZoom: number) => libreZoom + 1

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** OpenMapTiles POI class/subclass → our categories. */
const OMT_CATEGORY: Record<string, CategoryId> = {
  restaurant: 'food',
  fast_food: 'food',
  food_court: 'food',
  cafe: 'cafe',
  bar: 'nightlife',
  beer: 'nightlife',
  pub: 'nightlife',
  nightclub: 'nightlife',
  shop: 'shopping',
  mall: 'shopping',
  department_store: 'shopping',
  clothing_store: 'shopping',
  grocery: 'shopping',
  lodging: 'hotel',
  hotel: 'hotel',
  attraction: 'attraction',
  amusement_park: 'amusement',
  theme_park: 'amusement',
  water_park: 'amusement',
  museum: 'attraction',
  art_gallery: 'attraction',
  place_of_worship: 'attraction',
  castle: 'attraction',
  monument: 'attraction',
  park: 'nature',
  garden: 'nature',
  railway: 'transport',
  station: 'transport',
}

/** Prefer English labels (matching Japanese signage), falling back to the local name. */
function localizeLabels(map: LibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue
    const field: unknown = map.getLayoutProperty(layer.id, 'text-field')
    if (field && JSON.stringify(field).includes('name')) {
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', 'name:en'],
        ['get', 'name_en'],
        ['get', 'name:latin'],
        ['get', 'name'],
      ])
    }
  }
}

export default function LibreMapView(props: MapViewProps) {
  const { markers, user, camera, onMarkerClick } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<LibreMap | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const latest = useLatest(props)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const { initialCenter, initialZoom } = latest.current
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches

    let instance: LibreMap
    try {
      instance = new LibreMap({
        container,
        style: dark ? STYLE_DARK : STYLE_LIGHT,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: toLibreZoom(initialZoom),
        attributionControl: { compact: true },
        maxPitch: 70,
        // Render Japanese glyphs with local fonts instead of downloading glyph tiles.
        localIdeographFontFamily: "'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'Noto Sans JP', sans-serif",
      })
    } catch (error) {
      // MapLibre v6 requires WebGL2 and throws (GPUInitializationError) when it's unavailable.
      console.error('[map] failed to start', error)
      setUnsupported(true)
      return
    }

    const emitViewport = () => {
      const bounds = instance.getBounds()
      const center = instance.getCenter()
      latest.current.onViewportChange({
        bounds: { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() },
        center: { lat: center.lat, lng: center.lng },
        zoom: toGoogleZoom(instance.getZoom()),
        bearing: instance.getBearing(),
      })
    }

    instance.on('load', () => {
      localizeLabels(instance)
      instance.addSource(ACCURACY_SOURCE, { type: 'geojson', data: EMPTY })
      instance.addLayer({
        id: 'user-accuracy-fill',
        type: 'fill',
        source: ACCURACY_SOURCE,
        paint: { 'fill-color': '#2f7cf6', 'fill-opacity': 0.12 },
      })
      instance.addLayer({
        id: 'user-accuracy-line',
        type: 'line',
        source: ACCURACY_SOURCE,
        paint: { 'line-color': '#2f7cf6', 'line-opacity': 0.35, 'line-width': 1 },
      })
      setMap(instance)
      emitViewport()
    })

    instance.on('moveend', emitViewport)
    instance.on('dragstart', () => latest.current.onUserGesture())

    instance.on('click', (event) => {
      const target = event.originalEvent.target as HTMLElement | null
      if (target?.closest('.maplibregl-marker')) return // our own markers handle their clicks

      const clicked: LatLng = { lat: event.lngLat.lat, lng: event.lngLat.lng }
      const feature = instance
        .queryRenderedFeatures(event.point)
        .find((f) => f.sourceLayer === 'poi' && f.properties?.name)
      if (!feature) {
        latest.current.onMapClick(clicked, null)
        return
      }
      const p = feature.properties as Record<string, string | undefined>
      const geometry = feature.geometry
      const at =
        geometry.type === 'Point'
          ? { lat: geometry.coordinates[1] ?? clicked.lat, lng: geometry.coordinates[0] ?? clicked.lng }
          : clicked
      latest.current.onMapClick(at, {
        name: p['name:en'] ?? p.name_en ?? p.name,
        category: OMT_CATEGORY[p.subclass ?? ''] ?? OMT_CATEGORY[p.class ?? ''] ?? 'other',
      })
    })

    // Long-press to add a place: right-click on desktop, press-and-hold on touch screens.
    instance.on('contextmenu', (event) => latest.current.onLongPress({ lat: event.lngLat.lat, lng: event.lngLat.lng }))
    let pressTimer: ReturnType<typeof setTimeout> | undefined
    const cancelPress = () => clearTimeout(pressTimer)
    instance.on('touchstart', (event) => {
      cancelPress()
      if (event.originalEvent.touches.length !== 1) return
      const { lat, lng } = event.lngLat
      pressTimer = setTimeout(() => latest.current.onLongPress({ lat, lng }), 650)
    })
    instance.on('touchend', cancelPress)
    instance.on('touchcancel', cancelPress)
    instance.on('movestart', cancelPress)

    return () => {
      cancelPress()
      instance.remove()
      setMap(null)
    }
  }, [latest])

  // Accuracy ring around the blue dot.
  useEffect(() => {
    const source = map?.getSource(ACCURACY_SOURCE) as GeoJSONSource | undefined
    source?.setData(
      user
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [circlePolygon(user.location, user.accuracy)] },
              },
            ],
          }
        : EMPTY,
    )
  }, [map, user])

  // Camera commands (fly to a place, re-center on me, reset north).
  useEffect(() => {
    if (!map || !camera) return
    map.flyTo({
      ...(camera.center ? { center: [camera.center.lng, camera.center.lat] as [number, number] } : {}),
      ...(camera.zoom != null ? { zoom: toLibreZoom(camera.zoom) } : {}),
      ...(camera.bearing != null ? { bearing: camera.bearing, pitch: 0 } : {}),
      essential: true,
      maxDuration: 1800,
    })
  }, [map, camera])

  if (unsupported) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <p className="text-sm text-muted">המפה לא נתמכת בדפדפן הזה. נסו לעדכן את הדפדפן או לפתוח את האפליקציה ב-Chrome או ב-Safari.</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Sized with h-full (not absolute): maplibre-gl.css forces `.maplibregl-map { position: relative }`. */}
      <div ref={containerRef} className="h-full w-full" />
      {map &&
        markers.map((marker) => (
          <LibreMarker
            key={marker.id}
            map={map}
            position={marker.location}
            title={marker.name}
            zIndex={marker.selected ? 900 : marker.kind === 'saved' ? 500 : 100}
            onClick={() => onMarkerClick(marker)}
          >
            <MarkerPin
              category={marker.category}
              variant={marker.kind}
              selected={marker.selected}
              label={marker.selected ? marker.name : undefined}
            />
          </LibreMarker>
        ))}
      {map && user && (
        <LibreMarker map={map} position={user.location} zIndex={1000}>
          <UserDot />
        </LibreMarker>
      )}
    </div>
  )
}

interface LibreMarkerProps {
  map: LibreMap
  position: LatLng
  zIndex: number
  title?: string
  onClick?: () => void
  children: ReactNode
}

/** A MapLibre DOM marker whose content is rendered by React through a portal. */
function LibreMarker({ map, position, zIndex, title, onClick, children }: LibreMarkerProps) {
  const [element] = useState(() => document.createElement('div'))
  const markerRef = useRef<Marker | null>(null)
  const latestClick = useLatest(onClick)
  const latestPosition = useLatest(position)
  const { lat, lng } = position

  // Created once per map; position changes are applied below without re-creating the marker.
  useEffect(() => {
    const start = latestPosition.current
    const marker = new Marker({ element, anchor: 'center' }).setLngLat([start.lng, start.lat]).addTo(map)
    markerRef.current = marker
    const handleClick = (event: MouseEvent) => {
      event.stopPropagation()
      latestClick.current?.()
    }
    element.addEventListener('click', handleClick)
    return () => {
      element.removeEventListener('click', handleClick)
      marker.remove()
      markerRef.current = null
    }
  }, [map, element, latestClick, latestPosition])

  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat])
  }, [lat, lng])

  useEffect(() => {
    element.style.zIndex = String(zIndex)
    element.style.cursor = onClick ? 'pointer' : 'default'
    if (title) element.title = title
  }, [element, zIndex, title, onClick])

  return createPortal(children, element)
}
