import { CATEGORIES, categoryFromGoogleTypes } from '@/data/categories'
import type { CategoryId } from '@/data/types'
import { safeHttpUrl } from '@/lib/deeplinks'
import { boundsKey, boundsToCircle, distanceMeters } from '@/lib/geo'
import { dedupePois, type Poi, type PoiDetails, type PoiProvider, type Suggestion } from './poi'

/** Above this search radius the viewport is too large for meaningful "nearby" recommendations. */
const MAX_AREA_RADIUS_M = 25_000
const CACHE_TTL_MS = 10 * 60_000

/**
 * Google Places API (New) through the Maps JavaScript API `places` library.
 *
 * Cost control: only cheap "Pro" fields are requested for area searches, results are cached
 * per viewport, rich "Enterprise" fields (rating, hours…) are fetched only when a place is opened,
 * and autocomplete uses session tokens so a search + selection is billed as one session.
 */
export function createGoogleProvider(places: google.maps.PlacesLibrary): PoiProvider {
  const { Place, AutocompleteSuggestion, AutocompleteSessionToken } = places
  const areaCache = new Map<string, { at: number; pois: Poi[] }>()
  const detailsCache = new Map<string, Promise<PoiDetails | null>>()
  let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

  const toPoi = (place: google.maps.places.Place, fallback?: CategoryId): Poi | null => {
    const location = place.location
    if (!location) return null
    const detected = categoryFromGoogleTypes(place.primaryType, place.types)
    return {
      key: `g:${place.id}`,
      source: 'google',
      name: place.displayName ?? '',
      category: detected === 'other' && fallback ? fallback : detected,
      location: { lat: location.lat(), lng: location.lng() },
      address: place.formattedAddress ?? undefined,
      googlePlaceId: place.id,
    }
  }

  const BASIC_FIELDS = ['id', 'displayName', 'location', 'primaryType', 'types', 'formattedAddress']

  return {
    id: 'google',

    async searchArea(bounds, categories, signal) {
      const { center, radius } = boundsToCircle(bounds)
      if (radius > MAX_AREA_RADIUS_M) return { status: 'zoom-in' }

      const perCategory = await Promise.all(
        categories.map(async (category) => {
          const cacheKey = `${category}:${boundsKey(bounds)}`
          const cached = areaCache.get(cacheKey)
          if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.pois

          const { places: found } = await Place.searchNearby({
            fields: BASIC_FIELDS,
            locationRestriction: { center, radius: Math.max(radius, 300) },
            includedPrimaryTypes: CATEGORIES[category].googleTypes,
            maxResultCount: 20,
            rankPreference: 'POPULARITY',
            language: 'he',
            region: 'jp',
          })
          const pois = found.flatMap((place) => toPoi(place, category) ?? [])
          areaCache.set(cacheKey, { at: Date.now(), pois })
          return pois
        }),
      )
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return { status: 'ok', pois: dedupePois(perCategory.flat()) }
    },

    async suggest(input, near, signal) {
      sessionToken ??= new AutocompleteSessionToken()
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken,
        language: 'he',
        region: 'jp',
        includedRegionCodes: ['jp'],
        ...(near ? { locationBias: { center: near, radius: 30_000 } } : {}),
      })
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

      return suggestions.flatMap((suggestion): Suggestion[] => {
        const prediction = suggestion.placePrediction
        if (!prediction) return []
        return [
          {
            key: prediction.placeId,
            title: prediction.mainText?.text ?? prediction.text.text,
            subtitle: prediction.secondaryText?.text,
            resolve: async () => {
              const place = prediction.toPlace()
              await place.fetchFields({ fields: BASIC_FIELDS })
              sessionToken = null // the selection closes the billing session
              return toPoi(place)
            },
          },
        ]
      })
    },

    details(googlePlaceId) {
      let pending = detailsCache.get(googlePlaceId)
      if (!pending) {
        pending = (async (): Promise<PoiDetails | null> => {
          const place = new Place({ id: googlePlaceId, requestedLanguage: 'he', requestedRegion: 'jp' })
          await place.fetchFields({
            fields: [
              'displayName',
              'primaryType',
              'types',
              'photos',
              'rating',
              'userRatingCount',
              'formattedAddress',
              'regularOpeningHours',
              'websiteURI',
              'nationalPhoneNumber',
              'googleMapsURI',
              'priceLevel',
              'primaryTypeDisplayName',
            ],
          })
          return {
            name: place.displayName ?? undefined,
            category: categoryFromGoogleTypes(place.primaryType, place.types),
            photos: (place.photos ?? []).slice(0, 6).map((photo) => {
              const author = photo.authorAttributions[0]
              return {
                url: photo.getURI({ maxWidth: 960 }),
                attribution: author ? { name: author.displayName, uri: safeHttpUrl(author.uri) } : undefined,
              }
            }),
            rating: place.rating ?? undefined,
            ratingCount: place.userRatingCount ?? undefined,
            address: place.formattedAddress ?? undefined,
            weekdayHours: place.regularOpeningHours?.weekdayDescriptions,
            website: safeHttpUrl(place.websiteURI),
            phone: place.nationalPhoneNumber ?? undefined,
            googleMapsUri: safeHttpUrl(place.googleMapsURI),
            priceLevel: place.priceLevel ?? undefined,
            typeLabel: place.primaryTypeDisplayName ?? undefined,
          }
        })()
        // Don't cache failures: allow a retry the next time the place is opened.
        pending.catch(() => detailsCache.delete(googlePlaceId))
        detailsCache.set(googlePlaceId, pending)
      }
      return pending
    },

    async matchGoogle(name, location) {
      const { places: found } = await Place.searchByText({
        textQuery: name,
        fields: ['id', 'location'],
        locationBias: { center: location, radius: 1_000 },
        maxResultCount: 1,
        language: 'he',
        region: 'jp',
      })
      const match = found[0]
      if (!match?.location) return null
      const distance = distanceMeters(location, { lat: match.location.lat(), lng: match.location.lng() })
      return distance < 1_500 ? match.id : null
    },
  }
}
