/**
 * Live ILS ↔ JPY exchange rate from free, key-less sources:
 * - Frankfurter (European Central Bank reference rates, updated every business day)
 * - open.er-api.com as a fallback (updated daily)
 * The last good rate is kept in localStorage so the converter still works offline.
 */

export interface FxRate {
  /** Yen per one shekel. */
  jpyPerIls: number
  /** Day the rate was published, YYYY-MM-DD. */
  date: string
  /** When this device last fetched it (ms). */
  fetchedAt: number
}

const STORAGE_KEY = 'tabi:fx:ils-jpy'
/** Re-check the sources at most once an hour. */
export const FX_REFRESH_MS = 60 * 60_000

export function readCachedRate(): FxRate | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const rate = raw ? (JSON.parse(raw) as FxRate) : null
    return rate && rate.jpyPerIls > 0 ? rate : null
  } catch {
    return null
  }
}

function cacheRate(rate: FxRate) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rate))
  } catch {
    // Storage unavailable: the rate is simply fetched again next time.
  }
}

async function fromFrankfurter(signal: AbortSignal): Promise<FxRate> {
  const response = await fetch('https://api.frankfurter.dev/v1/latest?base=ILS&symbols=JPY', { signal })
  if (!response.ok) throw new Error(`Frankfurter ${response.status}`)
  const json = (await response.json()) as { date?: string; rates?: { JPY?: number } }
  const jpyPerIls = json.rates?.JPY
  if (!jpyPerIls || !json.date) throw new Error('Frankfurter: no JPY rate')
  return { jpyPerIls, date: json.date, fetchedAt: Date.now() }
}

async function fromErApi(signal: AbortSignal): Promise<FxRate> {
  const response = await fetch('https://open.er-api.com/v6/latest/ILS', { signal })
  if (!response.ok) throw new Error(`er-api ${response.status}`)
  const json = (await response.json()) as { result?: string; time_last_update_unix?: number; rates?: { JPY?: number } }
  const jpyPerIls = json.rates?.JPY
  if (json.result !== 'success' || !jpyPerIls) throw new Error('er-api: no JPY rate')
  const date = new Date((json.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10)
  return { jpyPerIls, date, fetchedAt: Date.now() }
}

/** Fetches the current rate (primary source, then fallback) and caches it. */
export async function fetchRate(signal: AbortSignal): Promise<FxRate> {
  let rate: FxRate
  try {
    rate = await fromFrankfurter(signal)
  } catch (error) {
    if (signal.aborted) throw error
    rate = await fromErApi(signal)
  }
  cacheRate(rate)
  return rate
}
