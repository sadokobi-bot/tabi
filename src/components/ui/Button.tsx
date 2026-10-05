import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-[0_10px_24px_-12px_var(--app-accent)] hover:brightness-105',
  secondary: 'surface text-fg hover:bg-fg/[0.03]',
  ghost: 'text-fg hover:bg-fg/6',
  danger: 'bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-400',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold whitespace-nowrap transition',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'lg' ? 'h-13 px-5 text-base' : 'h-11 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}
