import { useLayoutEffect, useRef } from 'react'

/** Ref that always holds the latest value: lets long-lived listeners call fresh callbacks. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
