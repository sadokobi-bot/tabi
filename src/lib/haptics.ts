/**
 * Light haptic tick on devices that support the Vibration API (Android Chrome).
 * Silently does nothing elsewhere: iOS Safari has no Vibration API.
 */
export function haptic(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration unavailable or blocked by the browser: ignore.
  }
}
