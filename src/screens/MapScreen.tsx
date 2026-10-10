import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTabActive } from '@/app/tabActive'
import { Assistant } from '@/components/map/Assistant'
import { CategoryChips } from '@/components/map/CategoryChips'
import { DayRouteBar, useDayRoute } from '@/components/map/DayRoute'
import { agoLabel, PeopleSheet } from '@/components/map/PeopleSheet'
import { colorFor } from '@/components/ui/Avatar'
import { useNow } from '@/hooks/useNow'
import { PRESENCE_FRESH_MS, usePresence } from '@/store/presence'
import { useCurrentUser } from '@/store/session'
import { MapControls } from '@/components/map/MapControls'
import { MapSearch } from '@/components/map/MapSearch'
import { NeedIcon, NeedsSheet, type NeedResult } from '@/components/map/NeedsSheet'
import { NEED_BY_ID, type NeedId } from '@/maps/needs'
import type { Poi } from '@/maps/poi'
import { PickLocationOverlay } from '@/components/map/PickLocationOverlay'
import type { MapMarker, MapPoiClick, MapViewProps, Viewport } from '@/components/map/types'
import { hasFirebase, hasGoogleMaps } from '@/config/env'
import { DEFAULT_CITY, getCity } from '@/data/cities'
import type { CategoryId, LatLng } from '@/data/types'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useTabReselect } from '@/hooks/useTabReselect'
import { tripTimeline } from '@/lib/dates'
import { useAreaRecommendations } from '@/maps/useAreaRecommendations'
import { usePoiProvider } from '@/maps/usePoiProvider'
import { useTrip, useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'
import { mapTourDue, startTour, useTour } from '@/store/tour'

// Only one engine is ever downloaded: Google Maps when a key is configured, otherwise MapLibre + OpenStreetMap.
const MapEngine = lazy<ComponentType<MapViewProps>>(() =>
  hasGoogleMaps ? import('@/components/map/GoogleMapView') : import('@/components/map/LibreMapView'),
)

const INITIAL_ZOOM = 13

export default function MapScreen() {
  const isActive = useTabActive()
  const provider = usePoiProvider()
  const trip = useTrip()
  const places = useTripStore((state) => state.places)
  const plan = useTripStore((state) => state.plan)
  const selection = useUi((state) => state.selection)
  const camera = useUi((state) => state.camera)
  const picking = useUi((state) => state.pickingLocation)
  const routeDate = useUi((state) => state.routeDate)
  const route = useDayRoute(routeDate)
  const me = useCurrentUser()
  const presence = usePresence((state) => state.byUid)
  const now = useNow(30_000).getTime()
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [needsOpen, setNeedsOpen] = useState(false)
  const [needResult, setNeedResult] = useState<NeedResult | null>(null)
  const [reopenNeed, setReopenNeed] = useState<NeedId | null>(null)

  const [showSaved, setShowSaved] = useState(true)
  const [categories, setCategories] = useState<CategoryId[]>([])
  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [following, setFollowing] = useState(false)
  const geo = useGeolocation(isActive)
  // No recommendations while a day route or nearby needs are shown (and none of their billed lookups).
  const recommendations = useAreaRecommendations(provider, route || needResult ? null : viewport, categories)
  const needOrigin = geo.fix?.location ?? viewport?.center ?? null

  // Frame the results together with where they were searched from.
  const showNeedResult = (result: NeedResult | null) => {
    setNeedResult(result)
    if (!result?.pois.length) return
    setFollowing(false)
    const points = [result.origin, ...result.pois.slice(0, 5).map((poi) => poi.location)]
    const lats = points.map((point) => point.lat)
    const lngs = points.map((point) => point.lng)
    ui.moveCamera({ bounds: { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) } })
  }

  const pickNeed = (poi: Poi) => {
    setNeedsOpen(false)
    setFollowing(false)
    ui.moveCamera({ center: poi.location, zoom: 17 })
    ui.openPoi(poi)
  }

  // Start where the trip is today: the day's city, else its first stop, else Tokyo.
  const [initialCenter] = useState<LatLng>(() => {
    const { focusDate } = tripTimeline(trip, new Date())
    const city = getCity(trip.dayCities[focusDate])
    if (city) return city.location
    const firstStop = plan[focusDate]?.[0]
    const firstPlace = firstStop ? useTripStore.getState().placesById[firstStop.placeId] : undefined
    return firstPlace?.location ?? DEFAULT_CITY.location
  })

  // Follow mode: keep the camera on the blue dot until the user pans away.
  useEffect(() => {
    if (following && geo.fix) ui.moveCamera({ center: geo.fix.location })
  }, [following, geo.fix])

  const locate = () => {
    if (geo.status === 'denied') {
      ui.toast('אין הרשאה למיקום. אפשרו גישה למיקום בהגדרות הדפדפן', 'error')
      return
    }
    if (geo.status === 'unavailable') {
      ui.toast('לא הצלחנו לאתר את המיקום כרגע', 'error')
      return
    }
    if (!geo.fix) {
      ui.toast('מאתרים את המיקום שלכם…')
      setFollowing(true)
      return
    }
    setFollowing(true)
    ui.moveCamera({ center: geo.fix.location, zoom: 16 })
  }

  useTabReselect('map', locate)

  // The map tour, the first time the map is opened (after the welcome tour).
  const tourOpen = useTour((state) => state.open)
  useEffect(() => {
    if (!isActive || tourOpen || useUi.getState().tripWizard || !mapTourDue(me.uid)) return
    const timer = setTimeout(() => mapTourDue(me.uid) && startTour('map'), 1000)
    return () => clearTimeout(timer)
  }, [isActive, tourOpen, me.uid])

  // Frame the whole day when a route opens or gains / loses a stop (not on every plan edit).
  const routePoints = route?.path
  const routeKey = route ? `${route.date}:${route.path.length}` : null
  useEffect(() => {
    if (!routeKey || !routePoints?.length) return
    setFollowing(false)
    if (routePoints.length === 1) {
      ui.moveCamera({ center: routePoints[0], zoom: 15 })
      return
    }
    const lats = routePoints.map((point) => point.lat)
    const lngs = routePoints.map((point) => point.lng)
    ui.moveCamera({ bounds: { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) } })
  }, [routeKey])

  const selectedId =
    selection?.kind === 'place' ? `place:${selection.placeId}` : selection?.kind === 'poi' ? `poi:${selection.poi.key}` : null

  // Trip members sharing their location (not us: we're the blue dot).
  const memberMarkers = useMemo<MapMarker[]>(
    () =>
      Object.entries(presence).flatMap(([uid, p]) =>
        uid === me.uid || now - p.at > PRESENCE_FRESH_MS
          ? []
          : [
              {
                id: `member:${uid}`,
                kind: 'saved' as const,
                name: p.name,
                category: 'other' as const,
                location: p.location,
                selected: false,
                member: { name: p.name, color: colorFor(p.name), ago: agoLabel(p.at, now) },
              },
            ],
      ),
    [presence, me.uid, now],
  )

  const markers = useMemo<MapMarker[]>(() => {
    if (route) return [...route.markers, ...memberMarkers]
    const savedGoogle = new Set(places.flatMap((p) => (p.googlePlaceId ? [p.googlePlaceId] : [])))
    const savedOsm = new Set(places.flatMap((p) => (p.osmId ? [p.osmId] : [])))
    const isSaved = (poi: { googlePlaceId?: string; osmId?: string }) =>
      (poi.googlePlaceId && savedGoogle.has(poi.googlePlaceId)) || (poi.osmId && savedOsm.has(poi.osmId))

    const saved: MapMarker[] = showSaved
      ? places.map((place) => ({
          id: `place:${place.id}`,
          kind: 'saved',
          name: place.name,
          category: place.category,
          location: place.location,
          selected: selectedId === `place:${place.id}`,
        }))
      : []

    const suggestions = needResult ? [...needResult.pois] : [...recommendations.pois]
    // Keep an opened search result / tapped POI visible even if it isn't a recommendation.
    if (selection?.kind === 'poi' && !suggestions.some((poi) => poi.key === selection.poi.key)) suggestions.push(selection.poi)

    const suggested: MapMarker[] = suggestions
      .filter((poi) => !isSaved(poi))
      .map((poi) => ({
        id: `poi:${poi.key}`,
        kind: 'suggested',
        name: poi.name,
        category: poi.category,
        location: poi.location,
        selected: selectedId === `poi:${poi.key}`,
        ...(needResult ? { icon: NEED_BY_ID[needResult.need].icon, color: NEED_BY_ID[needResult.need].color } : {}),
      }))

    return [...suggested, ...saved, ...memberMarkers]
  }, [route, memberMarkers, places, showSaved, recommendations.pois, needResult, selection, selectedId])

  const handleMarkerClick = (marker: MapMarker) => {
    if (marker.member) {
      setPeopleOpen(true)
      return
    }
    if (marker.id.startsWith('stop:')) {
      ui.openPlace(marker.id.split(':')[1]!)
      return
    }
    if (marker.kind === 'saved') {
      ui.openPlace(marker.id.slice('place:'.length))
      return
    }
    const key = marker.id.slice('poi:'.length)
    const poi =
      recommendations.pois.find((p) => p.key === key) ??
      needResult?.pois.find((p) => p.key === key) ??
      (selection?.kind === 'poi' ? selection.poi : undefined)
    if (poi) ui.openPoi(poi)
  }

  const handleMapClick = (location: LatLng, poi: MapPoiClick | null) => {
    if (picking) return
    if (poi?.googlePlaceId) {
      const saved = places.find((place) => place.googlePlaceId === poi.googlePlaceId)
      if (saved) ui.openPlace(saved.id)
      else
        ui.openPoi({
          key: `g:${poi.googlePlaceId}`,
          source: 'google',
          name: '',
          category: 'other',
          location,
          googlePlaceId: poi.googlePlaceId,
        })
      return
    }
    if (poi?.name) {
      ui.openPoi({
        key: `tile:${location.lat.toFixed(6)},${location.lng.toFixed(6)}`,
        source: 'osm',
        name: poi.name,
        category: poi.category ?? 'other',
        location,
      })
      return
    }
    if (selection) ui.closeSheet()
  }

  const toggleCategory = (category: CategoryId) =>
    setCategories((current) => (current.includes(category) ? current.filter((c) => c !== category) : [...current, category]))

  return (
    <div className="relative h-full w-full overflow-hidden bg-map">
      {/* Google's logo must stay visible, so its map ends above the tab bar; the free map runs edge to edge. */}
      <div className={hasGoogleMaps ? 'bottom-tabbar-zone absolute inset-x-0 top-0 overflow-hidden rounded-b-card' : 'absolute inset-0'}>
        <Suspense fallback={<MapLoading />}>
          <MapEngine
            markers={markers}
            path={route?.path}
            user={geo.fix}
            camera={camera}
            initialCenter={initialCenter}
            initialZoom={INITIAL_ZOOM}
            onMarkerClick={handleMarkerClick}
            onMapClick={handleMapClick}
            onLongPress={(location) => ui.openDraft({ name: '', category: 'attraction', location })}
            onViewportChange={setViewport}
            onUserGesture={() => setFollowing(false)}
          />
        </Suspense>
      </div>

      {/* Top overlay: search + filter chips (glass, floating over the map) */}
      <div aria-hidden className="status-blend absolute inset-x-0 top-0 z-[5] h-16" />
      <div className="pt-screen pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2">
        <div className="pointer-events-auto px-4" data-tour="map-search">
          <MapSearch provider={provider} near={viewport?.center ?? null} />
        </div>
        {route ? (
          <div className="pointer-events-auto">
            <DayRouteBar route={route} />
          </div>
        ) : needResult && !needsOpen ? (
          <NeedBar
            result={needResult}
            onOpen={() => {
              setReopenNeed(needResult.need)
              setNeedsOpen(true)
            }}
            onClear={() => setNeedResult(null)}
          />
        ) : (
          <>
            <div className="pointer-events-auto">
              <CategoryChips
                onNeeds={() => {
                  setReopenNeed(null)
                  setNeedsOpen(true)
                }}
                onHotels={() => {
                  setReopenNeed('hotel')
                  setNeedsOpen(true)
                }}
                showSaved={showSaved}
                savedCount={places.length}
                onToggleSaved={() => setShowSaved((value) => !value)}
                active={categories}
                onToggle={toggleCategory}
              />
            </div>
            <AreaStatus status={recommendations.status} count={recommendations.pois.length} />
          </>
        )}
      </div>

      {!picking && (
        <MapControls
          bearing={viewport?.bearing ?? 0}
          geoStatus={geo.status}
          following={following}
          onLocate={locate}
          onResetNorth={() => ui.moveCamera({ bearing: 0 })}
          onAdd={() => ui.setPicking(true)}
          onPeople={hasFirebase ? () => setPeopleOpen(true) : undefined}
          liveCount={memberMarkers.length}
        />
      )}

      {/* The AI helper runs on Gemini through Firebase, so it needs cloud mode. */}
      {!picking && hasFirebase && <Assistant provider={provider} near={viewport?.center ?? null} />}

      <PeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
      <NeedsSheet
        open={needsOpen}
        onClose={() => setNeedsOpen(false)}
        provider={provider}
        origin={needOrigin}
        fromGps={Boolean(geo.fix)}
        initialNeed={reopenNeed}
        onResult={showNeedResult}
        onPick={pickNeed}
      />

      {picking && (
        <PickLocationOverlay
          onConfirm={() => {
            if (viewport) ui.openDraft({ name: '', category: 'attraction', location: viewport.center })
          }}
          onCancel={() => ui.setPicking(false)}
        />
      )}
    </div>
  )
}

function AreaStatus({ status, count }: { status: string; count: number }) {
  const message =
    status === 'loading'
      ? 'מחפשים המלצות באזור…'
      : status === 'zoom-in'
        ? 'התקרבו במפה כדי לראות המלצות'
        : status === 'error'
          ? 'לא הצלחנו לטעון המלצות'
          : status === 'ok' && count === 0
            ? 'אין המלצות באזור הזה'
            : null

  return (
    <div className="flex justify-center">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
          >
            {status === 'loading' && <LoaderCircle aria-hidden className="size-3.5 animate-spin" />}
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** While nearby needs are on the map: what's shown, back to the list, or clear. */
function NeedBar({ result, onOpen, onClear }: { result: NeedResult; onOpen: () => void; onClear: () => void }) {
  const config = NEED_BY_ID[result.need]
  return (
    <div className="pointer-events-auto flex justify-center px-4">
      <div className="glass flex items-center gap-1 rounded-full py-1 ps-1 pe-1">
        <button type="button" onClick={onOpen} className="flex items-center gap-2 rounded-full py-0.5 ps-0.5 pe-3 text-sm font-semibold">
          <NeedIcon need={config} className="size-7 rounded-full" />
          {result.pois.length ? `${config.plural} בסביבה (${result.pois.length}) · לרשימה` : `לא נמצאו ${config.plural} בסביבה`}
        </button>
        <button
          type="button"
          aria-label="הסתרה מהמפה"
          onClick={onClear}
          className="tap-target relative grid size-8 place-items-center rounded-full bg-fg/8"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}

function MapLoading() {
  return (
    <div className="grid h-full place-items-center">
      <LoaderCircle aria-label="טוען מפה" className="size-7 animate-spin text-muted" />
    </div>
  )
}
