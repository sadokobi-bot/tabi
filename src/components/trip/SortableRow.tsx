import type { ReactNode } from 'react'
import clsx from 'clsx'
import { GripVertical, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { actions } from '@/data/actions'
import type { ItineraryItem, Place } from '@/data/types'
import { ui } from '@/store/ui'

interface RowContentProps {
  place: Place
  /** Present for scheduled items (not for unscheduled ideas). */
  date?: string
  item?: ItineraryItem
  /** Drag handle slot (start side). */
  handle?: ReactNode
  /** Rendered inside the drag overlay: static, slightly raised. */
  lifted?: boolean
}

/** Visual row shared by the sortable list and the drag overlay. */
export function RowContent({ place, date, item, handle, lifted = false }: RowContentProps) {
  return (
    <div
      className={clsx(
        'surface flex items-center gap-2 rounded-2xl py-1.5 pe-2',
        handle || lifted ? 'ps-0' : 'ps-2',
        lifted && 'shadow-[0_18px_40px_-12px_rgb(0_0_0/0.35)] ring-2 ring-accent/40',
      )}
    >
      {handle ?? (lifted && <GripVertical aria-hidden className="mx-2.5 size-4.5 text-muted" />)}
      <CategoryIcon category={place.category} className="size-9" />
      <button type="button" onClick={() => ui.openPlace(place.id)} className="min-w-0 flex-1 py-1.5 text-start">
        <span className="block truncate text-[15px] font-medium">{place.name}</span>
      </button>

      {lifted && item?.time && (
        <span className="px-2 text-sm font-semibold tabular-nums" dir="ltr">
          {item.time}
        </span>
      )}

      {!lifted && date && item && (
        <>
          <label>
            <span className="sr-only">שעה</span>
            <input
              type="time"
              value={item.time ?? ''}
              onChange={(event) => actions.setItemTime(date, item.id, event.target.value || undefined)}
              dir="ltr"
              className={clsx(
                'h-8 w-[6.25rem] shrink-0 rounded-xl px-1.5 text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-accent/40',
                item.time ? 'bg-fg/6 font-semibold' : 'bg-transparent text-muted',
              )}
            />
          </label>
          <button
            type="button"
            aria-label="הסרה מהיום"
            onClick={() => actions.removeFromDay(date, item.id)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8 hover:text-fg"
          >
            <X aria-hidden className="size-4" />
          </button>
        </>
      )}
    </div>
  )
}

interface SortableRowProps extends Omit<RowContentProps, 'handle' | 'lifted'> {
  id: string
}

/** Draggable row; dragging starts only from the grip handle so the list still scrolls on touch. */
export function SortableRow({ id, ...content }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(isDragging && 'opacity-35')}
    >
      <RowContent
        {...content}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`גרירת ${content.place.name}`}
            className="flex h-10 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4.5" />
          </button>
        }
      />
    </li>
  )
}
