import clsx from 'clsx'

/** The torii app mark (same artwork as public/icon.svg). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={clsx('shrink-0 rounded-[28%] shadow-lg', className ?? 'size-16')}>
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0704f" />
          <stop offset="1" stopColor="#c93a22" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#brand-bg)" />
      <g fill="#fff">
        <path d="M108 150 Q256 180 404 150 L398 182 Q256 206 114 182 Z" />
        <rect x="148" y="238" width="216" height="22" rx="3" />
        <rect x="246" y="190" width="20" height="50" />
        <rect x="174" y="180" width="28" height="212" rx="3" />
        <rect x="310" y="180" width="28" height="212" rx="3" />
      </g>
    </svg>
  )
}
