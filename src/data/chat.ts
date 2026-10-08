import { displayName, errorMessage } from '@/backend'
import { TRIP_TZ, zonedTimeToUtc } from '@/lib/dates'
import { haptic } from '@/lib/haptics'
import { newId } from '@/lib/ids'
import { getBackend, useSession } from '@/store/session'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'
import type { ChatMessage, MeetPoint, Place, SharedPlace } from './types'

export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏']

/** A meeting point stays pinned until this long after its time. */
const MEET_GRACE_MS = 30 * 60_000

function tripId(): string {
  const id = useTripStore.getState().activeTripId
  if (!id) throw new Error('No active trip')
  return id
}

/** Posts a message as the signed-in member. Not awaited: offline, it's queued and shown as waiting. */
export function sendChatMessage(fields: Pick<ChatMessage, 'text'> & Partial<Pick<ChatMessage, 'kind' | 'place' | 'meet' | 'poll'>>) {
  const user = useSession.getState().user
  if (!user) return
  const message: ChatMessage = {
    id: newId(),
    authorId: user.uid,
    authorName: displayName(user).slice(0, 40), // the rules cap chat names at 40
    createdAt: Date.now(),
    ...fields,
    text: fields.text.slice(0, 2000),
  }
  haptic()
  getBackend()
    .sendMessage(tripId(), message)
    .catch((error: unknown) => ui.toast(`ההודעה לא נשלחה: ${errorMessage(error)}`, 'error'))
}

export function reactTo(message: ChatMessage, emoji: string | null) {
  const uid = useSession.getState().user?.uid
  if (!uid) return
  haptic()
  getBackend()
    .reactToMessage(tripId(), message.id, uid, emoji)
    .catch((error: unknown) => ui.toast(errorMessage(error), 'error'))
}

export function voteIn(message: ChatMessage, option: number | null) {
  const uid = useSession.getState().user?.uid
  if (!uid) return
  haptic()
  getBackend()
    .voteInPoll(tripId(), message.id, uid, option)
    .catch((error: unknown) => ui.toast(errorMessage(error), 'error'))
}

/** What the chat keeps of a place: enough to show it and open it again. */
export function sharedPlaceOf(
  place: Pick<Place, 'name' | 'category' | 'location' | 'address' | 'googlePlaceId' | 'osmId'> & { id?: string },
): SharedPlace {
  return {
    name: place.name.slice(0, 120),
    category: place.category,
    location: place.location,
    ...(place.address ? { address: place.address.slice(0, 200) } : {}),
    ...(place.id ? { placeId: place.id } : {}),
    ...(place.googlePlaceId ? { googlePlaceId: place.googlePlaceId } : {}),
    ...(place.osmId ? { osmId: place.osmId } : {}),
  }
}

/** Opens a shared place: ours when it's saved in the trip, else as a map place. */
export function openSharedPlace(place: SharedPlace, key: string) {
  const saved = place.placeId ? useTripStore.getState().placesById[place.placeId] : undefined
  if (saved) {
    ui.openPlace(saved.id)
    return
  }
  ui.openPoi({
    key: place.googlePlaceId ? `g:${place.googlePlaceId}` : place.osmId ? `osm:${place.osmId}` : `chat:${key}`,
    source: place.googlePlaceId ? 'google' : 'osm',
    name: place.name,
    category: place.category,
    location: place.location,
    ...(place.address ? { address: place.address } : {}),
    ...(place.googlePlaceId ? { googlePlaceId: place.googlePlaceId } : {}),
    ...(place.osmId ? { osmId: place.osmId } : {}),
  })
}

export function meetInstant(meet: MeetPoint): number {
  return zonedTimeToUtc(meet.date, meet.time, TRIP_TZ).getTime()
}

/** The meeting point to pin: the latest one whose time hasn't long passed. */
export function currentMeet(messages: ChatMessage[], now: number): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]!
    if (message.kind !== 'meet' || !message.meet) continue
    return now < meetInstant(message.meet) + MEET_GRACE_MS ? message : undefined
  }
  return undefined
}

/** "בעוד 25 דק׳", "בעוד 1:10 ש׳", "עכשיו" */
export function untilLabel(ms: number, now: number): string {
  const minutes = Math.round((ms - now) / 60_000)
  if (minutes <= 0) return 'עכשיו'
  if (minutes < 60) return `בעוד ${minutes} דק׳`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `בעוד ${hours}:${String(rest).padStart(2, '0')} ש׳` : `בעוד ${hours} ש׳`
}
