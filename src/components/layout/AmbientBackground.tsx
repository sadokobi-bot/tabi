/**
 * Soft color fields behind the content screens. They give the glass layers something to blur,
 * so the frosted effect reads even on screens without imagery. Radial gradients are used
 * instead of `filter: blur()` because they cost nothing to composite.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -top-40 -right-32 size-[34rem] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--blob-sakura), transparent)' }}
      />
      <div
        className="absolute top-1/3 -left-48 size-[36rem] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--blob-ai), transparent)' }}
      />
      <div
        className="absolute right-1/4 -bottom-48 size-[30rem] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--blob-shu), transparent)' }}
      />
    </div>
  )
}
