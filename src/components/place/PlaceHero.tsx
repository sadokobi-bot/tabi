import { useState } from 'react'
import { Camera, X } from 'lucide-react'
import { CATEGORIES } from '@/data/categories'
import type { CategoryId } from '@/data/types'
import type { PoiPhoto } from '@/maps/poi'

interface PlaceHeroProps {
  category: CategoryId
  photos: PoiPhoto[]
  loading: boolean
  onClose: () => void
}

/** Photo strip (Google photos, with the required author attribution) or a category-colored header. */
export function PlaceHero({ category, photos, loading, onClose }: PlaceHeroProps) {
  const config = CATEGORIES[category]
  const Icon = config.icon
  // A photo that can't load (e.g. the day's photo quota is used up) is dropped instead of showing as broken.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const visible = photos.filter((photo) => !failed.has(photo.url))

  return (
    <div className="relative mx-3 overflow-hidden rounded-card">
      {loading ? (
        <div className="h-48 animate-pulse bg-fg/8" />
      ) : visible.length > 0 ? (
        <div className="no-scrollbar flex h-52 snap-x snap-mandatory overflow-x-auto">
          {visible.map((photo, index) => (
            <figure key={photo.url} className="relative h-full w-full shrink-0 snap-center">
              <img
                src={photo.url}
                alt=""
                loading={index === 0 ? 'eager' : 'lazy'}
                // The Maps key is locked to this site, so photo requests must say where they come from.
                referrerPolicy="strict-origin"
                onError={() => setFailed((current) => new Set(current).add(photo.url))}
                className="h-full w-full object-cover"
              />
              {photo.attribution && (
                <figcaption className="absolute start-2 bottom-2 max-w-[70%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white backdrop-blur">
                  {photo.attribution.uri ? (
                    <a href={photo.attribution.uri} target="_blank" rel="noopener noreferrer">
                      <Camera aria-hidden className="me-1 inline size-3 align-[-2px]" />
                      {photo.attribution.name}
                    </a>
                  ) : (
                    <>
                      <Camera aria-hidden className="me-1 inline size-3 align-[-2px]" />
                      {photo.attribution.name}
                    </>
                  )}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <div
          className="grid h-28 place-items-center"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${config.color} 85%, white), color-mix(in oklab, ${config.color} 70%, black))`,
          }}
        >
          <Icon aria-hidden className="size-11 text-white/90" strokeWidth={1.8} />
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="סגירה"
        className="tap-target absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition active:scale-90"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  )
}
