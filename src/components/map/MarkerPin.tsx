import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { CATEGORIES } from '@/data/categories'
import type { CategoryId } from '@/data/types'

interface MarkerPinProps {
  category: CategoryId
  variant: 'saved' | 'suggested'
  selected?: boolean
  label?: string
  /** Stop number on a day route (replaces the category icon). */
  order?: number
}

/**
 * Map pin shared by both map engines.
 * Saved places: solid category color with a white ring. Recommendations: translucent outline pins.
 */
export function MarkerPin({ category, variant, selected = false, label, order }: MarkerPinProps) {
  const config = CATEGORIES[category]
  const Icon = config.icon

  return (
    <div className={clsx('marker-pin', selected && 'is-selected')} style={{ '--pin': config.color } as CSSProperties}>
      <span className={clsx('marker-pin__dot', variant === 'saved' ? 'is-saved' : 'is-suggested', order != null && 'is-route')}>
        {order != null ? order : <Icon aria-hidden strokeWidth={2.4} />}
      </span>
      {label && <span className="marker-pin__label">{label}</span>}
    </div>
  )
}

/** The live "blue dot" with a pulsing halo. */
export function UserDot() {
  return <div className="user-dot" aria-label="המיקום שלך" />
}
