import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  /** Small line above the title (date, trip progress…). */
  eyebrow?: ReactNode
  title: string
  /** Optional element on the inline-end side (avatar, action button…). */
  trailing?: ReactNode
}

export function ScreenHeader({ eyebrow, title, trailing }: ScreenHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-muted">{eyebrow}</p>}
        <h1 className="mt-0.5 truncate text-[2rem] leading-tight font-bold tracking-tight">{title}</h1>
      </div>
      {trailing}
    </header>
  )
}
