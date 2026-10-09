import { getBackend, useSession } from '@/store/session'
import { isoDateInTz } from './dates'

/**
 * Daily caps per person for each AI feature, so the shared free quota lasts for everyone.
 * The same numbers are in firestore.rules (users/{uid}/usage/{day}); keep them in step.
 */
export const DAILY_LIMITS = {
  /** "תכנן לי את היום" (a revision counts too). */
  plan: 10,
  rain: 10,
  /** The whole trip at once. */
  trip: 3,
  /** Asking the assistant, and importing places from a post. */
  assistant: 30,
  translate: 20,
  entry: 40,
  /** Hebrew map searches put into English. */
  search: 40,
} as const

export type QuotaBucket = keyof typeof DAILY_LIMITS

export class QuotaError extends Error {
  constructor(readonly bucket: QuotaBucket) {
    super(`daily limit reached: ${bucket}`)
    this.name = 'QuotaError'
  }
}

/**
 * Counts one use for today (in Japan time, the same day on every phone), or throws a QuotaError when
 * today's are used up. If the count itself can't be saved (offline, or security rules not published
 * yet), the use goes ahead.
 */
export async function spend(bucket: QuotaBucket): Promise<void> {
  const uid = useSession.getState().user?.uid
  if (!uid) return
  let allowed = true
  try {
    allowed = await getBackend().spendUsage(uid, isoDateInTz(new Date()), bucket, DAILY_LIMITS[bucket])
  } catch (error) {
    console.warn('[quota] not counted', error)
  }
  if (!allowed) throw new QuotaError(bucket)
}
