import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Bookmark, LifeBuoy } from 'lucide-react'
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
}

/**
 * Floating, horizontally scrolling filter chips.
 * "Saved" toggles our own pins; each category toggles Google/OSM recommendations in the visible area.
 */
export function CategoryChips({ showSaved, savedCount, onToggleSaved, active, onToggle, onNeeds }: CategoryChipsProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1">
      <Chip pressed={false} color="var(--app-accent)" onClick={onNeeds} icon={LifeBuoy}>
        צריך עכשיו
      </Chip>
      <Chip pressed={showSaved} color="var(--app-accent)" onClick={onToggleSaved} icon={Bookmark}>
        שמורים · {savedCount}
      </Chip>
      {RECOMMENDABLE.map((id) => (
        <Chip key={id} pressed={active.includes(id)} color={CATEGORIES[id].color} onClick={() => onToggle(id)} icon={CATEGORIES[id].icon}>
          {CATEGORIES[id].plural}
        </Chip>
      ))}
    </div>
  )
}

interface ChipProps {
  pressed: boolean
  color: string
  icon: typeof Bookmark
  onClick: () => void
  children: ReactNode
}

function Chip({ pressed, color, icon: Icon, onClick, children }: ChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
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
