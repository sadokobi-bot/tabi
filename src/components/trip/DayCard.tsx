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
  /** Extra controls under the header (the night's stay). */
  extra?: ReactNode
  emptyLabel: string
  children: ReactNode
}

/** One droppable list (a trip day, or the "ideas" bucket) on the trip board. */
export function DayCard({ id, title, subtitle, itemIds, isToday, cityId, onCityChange, extra, emptyLabel, children }: DayCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      id={`day-${id}`}
      className={clsx(
        '-mx-2 scroll-mt-24 rounded-card p-2 transition-colors',
        isOver && 'bg-accent/[0.07] ring-1 ring-accent/40 ring-inset',
      )}
    >
      <header className="mb-2 flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1">
          <h3 className={clsx('flex items-center gap-2 font-bold', isToday && 'text-accent')}>
            {title}
            {isToday && <span className="rounded-full bg-accent-fill px-2 py-0.5 text-[11px] font-bold text-accent-fg">היום</span>}
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
                'h-9 max-w-[8.5rem] appearance-none rounded-full border-0 ps-3 pe-7 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/40',
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

      {extra && <div className="-mt-0.5 mb-2 px-1">{extra}</div>}

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
