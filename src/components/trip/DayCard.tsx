import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown } from 'lucide-react'
import { CITIES } from '@/data/cities'

interface DayCardProps {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  itemIds: string[]
  isToday?: boolean
  /** City picker value (dates only). */
  cityId?: string
  onCityChange?: (cityId: string | null) => void
  emptyLabel: string
  children: ReactNode
}

/** One droppable list (a trip day, or the "ideas" bucket) on the trip board. */
export function DayCard({ id, title, subtitle, itemIds, isToday, cityId, onCityChange, emptyLabel, children }: DayCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      id={`day-${id}`}
      className={clsx(
        'scroll-mt-24 rounded-card border p-3 transition-colors',
        isToday ? 'border-accent/35 bg-accent/[0.05]' : 'border-line bg-card/50',
        isOver && 'border-accent/60 bg-accent/[0.08]',
      )}
    >
      <header className="mb-2 flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-bold">
            {title}
            {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg">היום</span>}
          </h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {onCityChange && (
          <span className="relative shrink-0">
            <select
              value={cityId ?? ''}
              onChange={(event) => onCityChange(event.target.value || null)}
              aria-label="עיר"
              className={clsx(
                // appearance-none: Safari otherwise draws its own grey box and arrow.
                'h-8 max-w-[8.5rem] appearance-none rounded-full border-0 ps-3 pe-7 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/40',
                cityId ? 'bg-fg/8 text-fg' : 'bg-transparent text-muted',
              )}
            >
              <option value="">+ עיר</option>
              {CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          </span>
        )}
      </header>

      <SortableContext id={id} items={itemIds} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="min-h-12 space-y-2">
          {children}
          {itemIds.length === 0 && (
            <li className="grid h-12 place-items-center rounded-control border border-dashed border-line text-xs text-muted">
              {emptyLabel}
            </li>
          )}
        </ol>
      </SortableContext>
    </section>
  )
}
