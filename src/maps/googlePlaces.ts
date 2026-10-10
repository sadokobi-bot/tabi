import { CATEGORIES, categoryFromGoogleTypes } from '@/data/categories'
import type { CategoryId } from '@/data/types'
import { safeHttpUrl } from '@/lib/deeplinks'
import { boundsKey, boundsToCircle, distanceMeters } from '@/lib/geo'
import { sameName } from '@/lib/names'
import { HOTEL_BUDGETS, HOTEL_MIN_RATING, HOTEL_MIN_REVIEWS, HOTEL_ZONES, NEED_BY_ID, NEED_LIMIT, NEED_RADIUS_M } from './needs'
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
/**
 * Shared by every provider instance, for this session only: Google's terms don't allow storing
 * place details, and one request per place per session keeps usage inside the free tier.
 */
const detailsCache = new Map<string, Promise<PoiDetails | null>>()
const detailsSettled = new Map<string, PoiDetails | null>()
/** Japanese name and address per place, for the taxi card (same session-only rule). */
const localNamesCache = new Map<string, Promise<{ name?: string; address?: string } | null>>()

export function createGoogleProvider(places: google.maps.PlacesLibrary): PoiProvider {
  const { Place, AutocompleteSuggestion, AutocompleteSessionToken } = places
  const areaCache = new Map<string, { at: number; pois: Poi[] }>()
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

    localNames(googlePlaceId) {
      let pending = localNamesCache.get(googlePlaceId)
      if (!pending) {
        pending = (async () => {
          const place = new Place({ id: googlePlaceId, requestedLanguage: 'ja', requestedRegion: 'jp' })
          await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })
          return { name: place.displayName ?? undefined, address: place.formattedAddress ?? undefined }
        })()
        pending.catch(() => localNamesCache.delete(googlePlaceId))
        localNamesCache.set(googlePlaceId, pending)
      }
      return pending
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
            photos: (place.photos ?? []).slice(0, 3).map((photo) => {
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
            openingPeriods: place.regularOpeningHours?.periods.map((period) => ({
              open: { day: period.open.day, minutes: period.open.hour * 60 + period.open.minute },
              ...(period.close ? { close: { day: period.close.day, minutes: period.close.hour * 60 + period.close.minute } } : {}),
            })),
            website: safeHttpUrl(place.websiteURI),
            phone: place.nationalPhoneNumber ?? undefined,
            googleMapsUri: safeHttpUrl(place.googleMapsURI),
            priceLevel: place.priceLevel ?? undefined,
            typeLabel: place.primaryTypeDisplayName ?? undefined,
          }
        })()
        // Don't cache failures: allow a retry the next time the place is opened.
        pending.then(
          (data) => detailsSettled.set(googlePlaceId, data),
          () => detailsCache.delete(googlePlaceId),
        )
        detailsCache.set(googlePlaceId, pending)
      }
      return pending
    },

    peekDetails(googlePlaceId) {
      return detailsSettled.get(googlePlaceId)
    },

    async searchText(query, near, signal, options) {
      const { places: found } = await Place.searchByText({
        textQuery: query,
        fields: [...BASIC_FIELDS, 'rating', 'userRatingCount'],
        ...(near ? { locationBias: { center: near, radius: 15_000 } } : {}),
        maxResultCount: options?.limit ?? 6,
        language: options?.language ?? 'he',
        region: 'jp',
      })
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return found.flatMap((place) => {
        const poi = toPoi(place)
        return poi ? [{ ...poi, rating: place.rating ?? undefined, ratingCount: place.userRatingCount ?? undefined }] : []
      })
    },

    async nearby(need, near, signal, hotel = { budget: 'mid', zone: 'center' }) {
      const zone = HOTEL_ZONES[hotel.zone]
      const config = NEED_BY_ID[need]
      if (need === 'hotel') {
        // Recommended, not nearest: well-reviewed hotels of the chosen tier, best first.
        const { places: found } = await Place.searchByText({
          textQuery: HOTEL_BUDGETS[hotel.budget].query,
          includedType: 'lodging',
          fields: [...BASIC_FIELDS, 'rating', 'userRatingCount'],
          locationBias: { center: near, radius: zone.maxM },
          maxResultCount: 20,
          language: 'en',
          region: 'jp',
        })
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const score = (poi: Poi) => (poi.rating ?? 0) * Math.log10((poi.ratingCount ?? 0) + 10)
        return found
          .flatMap((place) => {
            const poi = toPoi(place)
            return poi
              ? [{ ...poi, category: config.category, rating: place.rating ?? undefined, ratingCount: place.userRatingCount ?? undefined }]
              : []
          })
          .filter(
            (poi) =>
              distanceMeters(near, poi.location) >= zone.minM &&
              distanceMeters(near, poi.location) <= zone.maxM &&
              (poi.rating ?? 0) >= HOTEL_MIN_RATING &&
              (poi.ratingCount ?? 0) >= HOTEL_MIN_REVIEWS,
          )
          .sort((a, b) => score(b) - score(a))
          .slice(0, 8)
      }
      // English names: they say "Seven Bank" / "Japan Post", which tells which ATMs take foreign cards.
      const byType = async () =>
        config.googleTypes
          ? (
              await Place.searchNearby({
                fields: BASIC_FIELDS,
                locationRestriction: { center: near, radius: NEED_RADIUS_M },
                includedTypes: config.googleTypes,
                maxResultCount: NEED_LIMIT,
                rankPreference: 'DISTANCE',
                language: 'en',
                region: 'jp',
              })
            ).places
          : []
      const byText = async () =>
        config.googleQuery
          ? (
              await Place.searchByText({
                textQuery: config.googleQuery,
                fields: BASIC_FIELDS,
                locationBias: { center: near, radius: NEED_RADIUS_M },
                maxResultCount: NEED_LIMIT,
                rankPreference: 'DISTANCE',
                language: 'en',
                region: 'jp',
              })
            ).places
          : []

      let found: google.maps.places.Place[] = []
      try {
        found = await byType()
      } catch (error) {
        if (!config.googleQuery) throw error
      }
      if (found.length === 0) found = await byText()
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      return found
        .flatMap((place) => {
          const poi = toPoi(place)
          return poi ? [{ ...poi, category: config.category, name: poi.name || config.noun }] : []
        })
        .filter((poi) => distanceMeters(near, poi.location) <= NEED_RADIUS_M * 1.5)
        .sort((a, b) => distanceMeters(near, a.location) - distanceMeters(near, b.location))
    },

    async verify(name, near, signal, area) {
      // English names, so they can be compared with the English name the AI gave.
      const { places: found } = await Place.searchByText({
        textQuery: area ? `${name} ${area}` : name,
        fields: [...BASIC_FIELDS, 'businessStatus'],
        locationBias: { center: near, radius: 3000 },
        maxResultCount: 5,
        language: 'en',
        region: 'jp',
      })
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      for (const place of found) {
        const poi = toPoi(place)
        if (!poi || String(place.businessStatus ?? '') === 'CLOSED_PERMANENTLY') continue
        if (distanceMeters(near, poi.location) <= 2500 && sameName(name, poi.name)) return poi
      }
      return null
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
