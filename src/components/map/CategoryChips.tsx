import type { ReactNode } from 'react'
import clsx from 'clsx'
import { BedDouble, Bookmark, LifeBuoy } from 'lucide-react'
import { motion } from 'motion/react'
import { CATEGORIES, RECOMMENDABLE } from '@/data/categories'
import type { CategoryId } from '@/data/types'
import { haptic } from '@/lib/haptics'

interface CategoryChipsProps {
  showSaved: boolean
  savedCount: number
  onToggleSaved: () => void
  active: CategoryId[]
  onToggle: (category: CategoryId) => void
  /** Opens "I need … now" (toilets, ATMs…). */
  onNeeds: () => void
  /** Opens the recommended hotels for a city. */
  onHotels: () => void
}

/**
 * Floating, horizontally scrolling filter chips.
 * "Saved" toggles our own pins; each category toggles Google/OSM recommendations in the visible area.
 */
export function CategoryChips({ showSaved, savedCount, onToggleSaved, active, onToggle, onNeeds, onHotels }: CategoryChipsProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1">
      <Chip pressed={false} color="var(--app-accent)" onClick={onNeeds} icon={LifeBuoy} tour="needs-chip">
        צריך עכשיו
      </Chip>
      <Chip pressed={false} color="#7c3aed" onClick={onHotels} icon={BedDouble} tour="hotels-chip">
        מלונות
      </Chip>
      <Chip pressed={showSaved} color="var(--app-accent)" onClick={onToggleSaved} icon={Bookmark} tour="saved-chip">
        שמורים · {savedCount}
      </Chip>
      <div data-tour="categories" className="flex shrink-0 gap-2">
        {RECOMMENDABLE.map((id) => (
          <Chip key={id} pressed={active.includes(id)} color={CATEGORIES[id].color} onClick={() => onToggle(id)} icon={CATEGORIES[id].icon}>
            {CATEGORIES[id].plural}
          </Chip>
        ))}
      </div>
    </div>
  )
}

interface ChipProps {
  pressed: boolean
  color: string
  icon: typeof Bookmark
  onClick: () => void
  children: ReactNode
  /** Marks the chip for the map tour. */
  tour?: string
}

function Chip({ pressed, color, icon: Icon, onClick, children, tour }: ChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      data-tour={tour}
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        haptic()
        onClick()
      }}
      className={clsx(
        'tap-target relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
        pressed ? 'text-white shadow-lg' : 'glass text-fg',
      )}
      style={pressed ? { background: color } : undefined}
    >
      <Icon aria-hidden className="size-4" style={pressed ? undefined : { color }} />
      {children}
    </motion.button>
  )
}
