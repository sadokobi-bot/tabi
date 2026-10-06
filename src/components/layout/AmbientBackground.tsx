/**
 * The paper the app is printed on: washi fibre grain plus a soft warm light from the top,
 * like a notebook page under a lamp. Pure CSS, nothing to load.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[28rem]"
        style={{ background: 'radial-gradient(120% 90% at 85% 0%, color-mix(in oklab, var(--app-accent) 9%, transparent), transparent 70%)' }}
      />
      <div className="paper-grain absolute inset-0" />
    </div>
  )
}
