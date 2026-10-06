import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, MapPin, Search, X } from 'lucide-react'
import type { LatLng } from '@/data/types'
import { useLatest } from '@/hooks/useLatest'
import type { PoiProvider, Suggestion } from '@/maps/poi'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

interface MapSearchProps {
  provider: PoiProvider | null
  near: LatLng | null
}

/** Floating glass search: type-ahead over Google Places (or OpenStreetMap), opens the result's sheet. */
export function MapSearch({ provider, near }: MapSearchProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  // Bias only: a moving map shouldn't re-trigger the search.
  const nearRef = useLatest(near)

  const trimmed = query.trim()

  useEffect(() => {
    if (!provider || trimmed.length < 2) {
      setResults([])
      setStatus('idle')
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    const timer = setTimeout(() => {
      provider.suggest(trimmed, nearRef.current, controller.signal).then(
        (found) => {
          if (controller.signal.aborted) return
          setResults(found)
          setStatus('idle')
        },
        () => {
          if (!controller.signal.aborted) setStatus('error')
        },
      )
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [provider, trimmed, nearRef])

  const choose = async (suggestion: Suggestion) => {
    setStatus('loading')
    const poi = await suggestion.resolve().catch(() => null)
    setStatus('idle')
    if (!poi) {
      ui.toast('לא הצלחנו לטעון את המקום', 'error')
      return
    }
    setQuery('')
    setResults([])
    inputRef.current?.blur()
    ui.moveCamera({ center: poi.location, zoom: 16 })

    // Already saved? Open our copy (with notes and schedule) instead of the raw result.
    const savedMatch = useTripStore
      .getState()
      .places.find(
        (place) =>
          (poi.googlePlaceId && place.googlePlaceId === poi.googlePlaceId) || (poi.osmId && place.osmId === poi.osmId),
      )
    if (savedMatch) ui.openPlace(savedMatch.id)
    else ui.openPoi(poi)
  }

  const open = focused && trimmed.length >= 2

  return (
    <div className="relative">
      <div className="glass flex h-12 items-center gap-2 rounded-card ps-3.5 pe-2">
        {status === 'loading' ? (
          <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-muted" />
        ) : (
          <Search aria-hidden className="size-5 shrink-0 text-muted" />
        )}
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            const first = results[0]
            if (event.key === 'Enter' && first) void choose(first)
          }}
          placeholder="חיפוש מקומות ביפן"
          aria-label="חיפוש מקומות"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="ניקוי החיפוש"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setQuery('')}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-fg/8"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="glass absolute inset-x-0 top-14 z-20 max-h-[50dvh] overflow-y-auto rounded-card p-1.5" role="listbox">
          {results.map((suggestion) => (
            <button
              key={suggestion.key}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void choose(suggestion)}
              className="flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-start hover:bg-fg/6"
            >
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{suggestion.title}</span>
                {suggestion.subtitle && <span className="block truncate text-xs text-muted">{suggestion.subtitle}</span>}
              </span>
            </button>
          ))}
          {status === 'idle' && results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted">לא נמצאו תוצאות</p>
          )}
          {status === 'error' && <p className="px-3 py-3 text-sm text-red-600">החיפוש נכשל. בדקו את החיבור לאינטרנט</p>}
          <p className="px-3 pt-1 pb-1.5 text-[10px] text-muted">
            {provider?.id === 'google' ? 'תוצאות: Google' : 'תוצאות: OpenStreetMap'}
          </p>
        </div>
      )}
    </div>
  )
}
