import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  /** Supporting line under the title (dates, counts…). */
  subtitle?: ReactNode
  title: string
  /** Optional element on the inline-end side (avatar, action button…). */
  trailing?: ReactNode
}

export function ScreenHeader({ subtitle, title, trailing }: ScreenHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-[2rem] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {trailing}
    </header>
  )
}
