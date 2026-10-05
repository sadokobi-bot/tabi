import clsx from 'clsx'

const PALETTE = ['#e2553a', '#e8890c', '#16a34a', '#2f7cf6', '#8b5cf6', '#db2777', '#0d9488']

function colorFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden
      className={clsx('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className ?? 'size-10 text-base')}
      style={{ background: colorFor(name) }}
    >
      {initial}
    </span>
  )
}
