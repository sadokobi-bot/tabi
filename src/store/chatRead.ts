import { useMemo } from 'react'
import { create } from 'zustand'
import { useSession } from './session'
import { useTripStore } from './trip'

/**
 * "Read up to" marker per user and trip, kept on this device. It stores the newest message's own
 * timestamp (not this device's clock), so a phone with a wrong clock can't hide or resurrect messages.
 */
const storageKey = (uid: string, tripId: string) => `tabi:chatRead:${uid}:${tripId}`

const useChatRead = create<{ lastRead: Record<string, number> }>(() => ({ lastRead: {} }))

function storedLastRead(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

export function markChatRead(uid: string, tripId: string, upTo: number) {
  const key = storageKey(uid, tripId)
  const current = useChatRead.getState().lastRead[key] ?? storedLastRead(key)
  if (upTo <= current) return
  useChatRead.setState((state) => ({ lastRead: { ...state.lastRead, [key]: upTo } }))
  try {
    localStorage.setItem(key, String(upTo))
  } catch {
    // Storage unavailable: unread state just resets on reload.
  }
}

/** Messages from the other trip members that arrived after the user last opened the chat. */
export function useUnreadCount(): number {
  const uid = useSession((state) => state.user?.uid)
  const tripId = useTripStore((state) => state.activeTripId)
  const messages = useTripStore((state) => state.messages)
  const key = uid && tripId ? storageKey(uid, tripId) : null
  const lastRead = useChatRead((state) => (key ? (state.lastRead[key] ?? storedLastRead(key)) : 0))

  return useMemo(
    () => (uid ? messages.filter((message) => message.authorId !== uid && message.createdAt > lastRead).length : 0),
    [messages, uid, lastRead],
  )
}
