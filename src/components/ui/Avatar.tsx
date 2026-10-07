import clsx from 'clsx'

/** Mid-tone hues that read on light and dark surfaces and stay clear of the app's vermilion accent. */
const PALETTE = ['#6366f1', '#0d9488', '#db2777', '#8b5cf6', '#0284c7', '#d97706', '#059669']

function colorFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

/** A member's initial on a soft tint (like the category tiles); the same name always gets the same hue. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const color = colorFor(name)
  return (
    <span
      aria-hidden
      className={clsx('inline-grid shrink-0 place-items-center rounded-full font-bold', className ?? 'size-10 text-base')}
      style={{
        color,
        // Tint over an opaque card base, so it stays crisp on tinted or blurred backgrounds.
        background: `color-mix(in oklab, ${color} 16%, var(--app-card))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${color} 30%, transparent), 0 2px 8px -4px rgb(0 0 0 / 0.18)`,
      }}
    >
      {initial}
    </span>
  )
}
