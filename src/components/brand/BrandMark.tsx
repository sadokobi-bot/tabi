import clsx from 'clsx'

/** The torii app mark, printed like a vermilion seal (same artwork as public/icon.svg). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={clsx('shrink-0 rounded-[28%] shadow-[0_8px_20px_-10px_#d4442a]', className ?? 'size-16')}>
      <rect width="512" height="512" fill="#d4442a" />
      <rect x="22" y="22" width="468" height="468" rx="118" fill="none" stroke="#fffaf2" strokeOpacity="0.55" strokeWidth="10" />
      <g fill="#fffaf2">
        <path d="M108 150 Q256 180 404 150 L398 182 Q256 206 114 182 Z" />
        <rect x="148" y="238" width="216" height="22" rx="3" />
        <rect x="246" y="190" width="20" height="50" />
        <rect x="174" y="180" width="28" height="212" rx="3" />
        <rect x="310" y="180" width="28" height="212" rx="3" />
      </g>
    </svg>
  )
}
