import type { CSSProperties } from 'react'
import clsx from 'clsx'
import { CATEGORIES } from '@/data/categories'
import type { CategoryId } from '@/data/types'

/** Soft-tinted rounded square with the category icon (lists, timeline, sheet header). */
export function CategoryIcon({ category, className }: { category: CategoryId; className?: string }) {
  const config = CATEGORIES[category]
  const Icon = config.icon
  return (
    <span
      aria-hidden
      className={clsx('inline-grid shrink-0 place-items-center rounded-xl', className ?? 'size-10')}
      style={{ background: `color-mix(in oklab, ${config.color} 14%, transparent)`, color: config.color } as CSSProperties}
    >
      <Icon className="size-[52%]" strokeWidth={2.2} />
    </span>
  )
}

export function CategoryBadge({ category }: { category: CategoryId }) {
  const config = CATEGORIES[category]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `color-mix(in oklab, ${config.color} 14%, transparent)`, color: config.color }}
    >
      {config.label}
    </span>
  )
}
