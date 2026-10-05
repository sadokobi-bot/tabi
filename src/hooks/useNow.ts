import { useEffect, useState } from 'react'

/** Current time, re-rendering every `intervalMs` (aligned to the interval boundary). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs))
    }
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs))
    return () => clearTimeout(timer)
  }, [intervalMs])

  return now
}
