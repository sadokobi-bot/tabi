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
  /** Replaces the category icon (nearby needs). */
  emoji?: string
}

/**
 * Map pin shared by both map engines.
 * Saved places: solid category color with a white ring. Recommendations: translucent outline pins.
 */
export function MarkerPin({ category, variant, selected = false, label, order, emoji }: MarkerPinProps) {
  const config = CATEGORIES[category]
  const Icon = config.icon

  return (
    <div className={clsx('marker-pin', selected && 'is-selected')} style={{ '--pin': config.color } as CSSProperties}>
      <span className={clsx('marker-pin__dot', variant === 'saved' ? 'is-saved' : 'is-suggested', order != null && 'is-route')}>
        {order != null ? (
          order
        ) : emoji ? (
          <span aria-hidden className="marker-pin__emoji">
            {emoji}
          </span>
        ) : (
          <Icon aria-hidden strokeWidth={2.4} />
        )}
      </span>
      {label && <span className="marker-pin__label">{label}</span>}
    </div>
  )
}

/** A trip member sharing their location: their initial in their color, with name and freshness. */
export function MemberPin({ name, color, ago }: { name: string; color: string; ago: string }) {
  return (
    <div className="member-pin" style={{ '--member': color } as CSSProperties}>
      <span className="member-pin__dot">{name.trim().charAt(0).toUpperCase() || '?'}</span>
      <span className="marker-pin__label">
        {name} · {ago}
      </span>
    </div>
  )
}

/** The live "blue dot" with a pulsing halo. */
export function UserDot() {
  return <div className="user-dot" aria-label="המיקום שלך" />
}
