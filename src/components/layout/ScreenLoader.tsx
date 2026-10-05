/** Suspense fallback for code-split screens. Fades in after a short delay, so fast loads never flash a spinner. */
export function ScreenLoader() {
  return (
    <div role="status" aria-label="טוען…" className="grid h-full min-h-60 animate-fade-in-delayed place-items-center">
      <span className="size-7 animate-spin rounded-full border-[2.5px] border-fg/10 border-t-accent" />
    </div>
  )
}
