import clsx from 'clsx'

/** The app icon (public/icon.svg), rounded like it is on the home screen. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon.svg`}
      alt=""
      aria-hidden
      draggable={false}
      className={clsx('shrink-0 rounded-[22.5%] shadow-lg', className ?? 'size-16')}
    />
  )
}
