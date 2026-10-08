import type { ChatMessage, ChatMeta, DayPlan, JoinRequest, Place, Presence, Ticket, Trip } from '@/data/types'
import { cachedPages, cachePages, dropPages } from '@/lib/ticketCache'
import { newId, newInviteCode, normalizeInviteCode } from '@/lib/ids'
import { AppError, memberOf, type Backend, type Profile, type SessionUser } from './types'
import { checkUsername } from './username'

/**
 * Local backend: accounts and trip data live in this browser's localStorage.
 * Fully functional with zero setup; data stays on this device. Passwords are stored as
 * salted PBKDF2-SHA256 hashes, never in plain text.
 */

const PREFIX = 'tabi:v1:'

interface LocalUser {
  uid: string
  username: string
  salt: string
  hash: string
  createdAt: number
  profile?: Profile
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/* ── Change notifications (same tab via emit, other tabs via the storage event) ── */
const listeners = new Map<string, Set<() => void>>()

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener())
}

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
  emit(key)
}

window.addEventListener('storage', (event) => {
  if (event.key?.startsWith(PREFIX)) emit(event.key.slice(PREFIX.length))
})

/* ── Password hashing ── */
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [])

async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, key, 256)
  return { salt: toHex(salt), hash: toHex(new Uint8Array(bits)) }
}

/* ── Trip storage helpers ── */
const tripsKey = 'trips'
const invitesKey = 'invites'
const placesKey = (tripId: string) => `places:${tripId}`
const planKey = (tripId: string) => `plan:${tripId}`
const messagesKey = (tripId: string) => `messages:${tripId}`
const presenceKey = (tripId: string) => `presence:${tripId}`
const chatMetaKey = (tripId: string) => `chatMeta:${tripId}`
// The list here; the pages (too big for localStorage) in IndexedDB.
const ticketsKey = (tripId: string) => `tickets:${tripId}`
const requestsKey = (tripId: string) => `requests:${tripId}`
/** Keeps localStorage small: only the latest messages are stored. */
const MESSAGE_LIMIT = 300

function readTrips() {
  return read<Record<string, Trip>>(tripsKey, {})
}

function updateTripRecord(tripId: string, update: (trip: Trip) => Trip) {
  const trips = readTrips()
  const trip = trips[tripId]
  if (!trip) throw new AppError('unknown', 'הטיול לא נמצא')
  trips[tripId] = update(trip)
  write(tripsKey, trips)
}

function updateMessage(tripId: string, messageId: string, update: (message: ChatMessage) => ChatMessage) {
  write(
    messagesKey(tripId),
    read<ChatMessage[]>(messagesKey(tripId), []).map((message) => (message.id === messageId ? update(message) : message)),
  )
}

export function createLocalBackend(): Backend {
  return {
    mode: 'local',

    onAuthChange(callback) {
      const notify = () => {
        const uid = read<string | null>('session', null)
        const user = uid ? Object.values(read<Record<string, LocalUser>>('users', {})).find((u) => u.uid === uid) : undefined
        callback(user ? ({ uid: user.uid, username: user.username, profile: user.profile ?? null } satisfies SessionUser) : null)
      }
      notify()
      const stopSession = subscribe('session', notify)
      const stopUsers = subscribe('users', notify)
      return () => {
        stopSession()
        stopUsers()
      }
    },

    async signIn(username, password) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-credentials')
      const user = read<Record<string, LocalUser>>('users', {})[check.key]
      if (!user) throw new AppError('invalid-credentials')
      const { hash } = await hashPassword(password, user.salt)
      if (hash !== user.hash) throw new AppError('invalid-credentials')
      write('session', user.uid)
    },

    async signUp(username, password, profile) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-username', check.reason)
      if (password.length < 6) throw new AppError('weak-password')
      const users = read<Record<string, LocalUser>>('users', {})
      if (users[check.key]) throw new AppError('username-taken')
      const { salt, hash } = await hashPassword(password)
      const uid = newId()
      users[check.key] = { uid, username: check.display, salt, hash, createdAt: Date.now(), profile }
      write('users', users)
      write('session', uid)
    },

    async signOut() {
      localStorage.removeItem(`${PREFIX}session`)
      emit('session')
    },

    watchTrips(uid, callback) {
      const notify = () =>
        callback(
          Object.values(readTrips())
            .filter((trip) => trip.memberIds.includes(uid))
            .map((trip) => ({ ...trip, stays: trip.stays ?? {} })),
          true,
        )
      notify()
      return subscribe(tripsKey, notify)
    },

    async createTrip(user, input) {
      const id = newId()
      const inviteCode = newInviteCode()
      const trip: Trip = {
        id,
        name: input.name,
        startDate: input.startDate,
        days: input.days,
        ownerId: user.uid,
        memberIds: [user.uid],
        members: { [user.uid]: memberOf(user) },
        inviteCode,
        dayCities: {},
        stays: {},
        flights: [],
        createdAt: Date.now(),
      }
      write(placesKey(id), {})
      write(planKey(id), {})
      write(invitesKey, { ...read<Record<string, string>>(invitesKey, {}), [inviteCode]: id })
      write(tripsKey, { ...readTrips(), [id]: trip })
      return id
    },

    async saveProfile(user, profile, tripIds) {
      const users = read<Record<string, LocalUser>>('users', {})
      const entry = Object.entries(users).find(([, u]) => u.uid === user.uid)
      if (!entry) throw new AppError('unknown')
      users[entry[0]] = { ...entry[1], profile }
      write('users', users)
      const member = memberOf({ ...user, profile })
      for (const tripId of tripIds) updateTripRecord(tripId, (trip) => ({ ...trip, members: { ...trip.members, [user.uid]: member } }))
    },

    async requestJoin(user, inviteCode) {
      const tripId = read<Record<string, string>>(invitesKey, {})[normalizeInviteCode(inviteCode)]
      const trip = tripId ? readTrips()[tripId] : undefined
      if (!tripId || !trip) throw new AppError('invite-not-found')
      const names = { tripName: trip.name, ownerName: trip.members[trip.ownerId]?.name ?? '' }
      if (trip.memberIds.includes(user.uid)) return { tripId, member: true, ...names }
      const request: JoinRequest = { uid: user.uid, ...memberOf(user), at: Date.now(), status: 'pending' }
      write(requestsKey(tripId), { ...read<Record<string, JoinRequest>>(requestsKey(tripId), {}), [user.uid]: request })
      return { tripId, member: false, ...names }
    },

    watchJoinStatus(tripId, uid, callback) {
      const notify = () => {
        const request = read<Record<string, JoinRequest>>(requestsKey(tripId), {})[uid]
        callback(!request ? { state: 'none' } : request.status === 'declined' ? { state: 'declined' } : { state: 'pending' })
      }
      notify()
      return subscribe(requestsKey(tripId), notify)
    },

    async cancelJoinRequest(tripId, uid) {
      const { [uid]: _removed, ...rest } = read<Record<string, JoinRequest>>(requestsKey(tripId), {})
      write(requestsKey(tripId), rest)
    },

    watchJoinRequests(tripId, callback) {
      const notify = () =>
        callback(
          Object.values(read<Record<string, JoinRequest>>(requestsKey(tripId), {}))
            .filter((request) => request.status === 'pending')
            .sort((a, b) => a.at - b.at),
        )
      notify()
      return subscribe(requestsKey(tripId), notify)
    },

    async approveJoin(tripId, request) {
      updateTripRecord(tripId, (trip) =>
        trip.memberIds.includes(request.uid)
          ? trip
          : {
              ...trip,
              memberIds: [...trip.memberIds, request.uid],
              members: { ...trip.members, [request.uid]: { name: request.name, ...(request.gender ? { gender: request.gender } : {}) } },
            },
      )
      const { [request.uid]: _approved, ...rest } = read<Record<string, JoinRequest>>(requestsKey(tripId), {})
      write(requestsKey(tripId), rest)
    },

    async declineJoin(tripId, uid) {
      const requests = read<Record<string, JoinRequest>>(requestsKey(tripId), {})
      if (requests[uid]) write(requestsKey(tripId), { ...requests, [uid]: { ...requests[uid], status: 'declined' } })
    },

    async removeMember(tripId, uid) {
      updateTripRecord(tripId, (trip) => {
        const { [uid]: _removed, ...members } = trip.members
        return { ...trip, memberIds: trip.memberIds.filter((id) => id !== uid), members }
      })
    },

    async deleteTrip(trip) {
      const tickets = read<Ticket[]>(ticketsKey(trip.id), [])
      await Promise.all(tickets.map((ticket) => dropPages(ticket.id)))
      for (const key of [placesKey, planKey, messagesKey, presenceKey, chatMetaKey, ticketsKey, requestsKey].map((k) => k(trip.id))) {
        localStorage.removeItem(PREFIX + key)
        emit(key)
      }
      const { [trip.inviteCode]: _invite, ...invites } = read<Record<string, string>>(invitesKey, {})
      write(invitesKey, invites)
      const { [trip.id]: _trip, ...trips } = readTrips()
      write(tripsKey, trips)
    },

    async updateTrip(tripId, patch) {
      updateTripRecord(tripId, (trip) => ({ ...trip, ...patch }))
    },

    async setDayCity(tripId, date, cityId) {
      updateTripRecord(tripId, (trip) => {
        const dayCities = { ...trip.dayCities }
        if (cityId) dayCities[date] = cityId
        else delete dayCities[date]
        return { ...trip, dayCities }
      })
    },

    async setStay(tripId, date, placeId) {
      updateTripRecord(tripId, (trip) => {
        const stays = { ...trip.stays }
        if (placeId === null) delete stays[date]
        else stays[date] = placeId
        return { ...trip, stays }
      })
    },

    watchPlaces(tripId, callback) {
      const notify = () => callback(Object.values(read<Record<string, Place>>(placesKey(tripId), {})))
      notify()
      return subscribe(placesKey(tripId), notify)
    },

    async savePlace(tripId, place) {
      write(placesKey(tripId), { ...read<Record<string, Place>>(placesKey(tripId), {}), [place.id]: place })
    },

    async deletePlace(tripId, placeId, planChanges) {
      const places = read<Record<string, Place>>(placesKey(tripId), {})
      delete places[placeId]
      write(planKey(tripId), { ...read<DayPlan>(planKey(tripId), {}), ...planChanges })
      write(placesKey(tripId), places)
    },

    watchPlan(tripId, callback) {
      const notify = () => callback(read<DayPlan>(planKey(tripId), {}))
      notify()
      return subscribe(planKey(tripId), notify)
    },

    async updatePlan(tripId, changes) {
      write(planKey(tripId), { ...read<DayPlan>(planKey(tripId), {}), ...changes })
    },

    watchMessages(tripId, callback) {
      const notify = () => callback(read<ChatMessage[]>(messagesKey(tripId), []))
      notify()
      return subscribe(messagesKey(tripId), notify)
    },

    async sendMessage(tripId, message) {
      const messages = [...read<ChatMessage[]>(messagesKey(tripId), []), message].sort((a, b) => a.createdAt - b.createdAt)
      write(messagesKey(tripId), messages.slice(-MESSAGE_LIMIT))
    },

    async deleteMessage(tripId, message) {
      updateMessage(tripId, message.id, ({ id, authorId, authorName, createdAt }) => ({
        id,
        authorId,
        authorName,
        createdAt,
        text: '',
        deleted: true,
      }))
    },

    async reactToMessage(tripId, messageId, uid, emoji) {
      updateMessage(tripId, messageId, (message) => {
        const { [uid]: _previous, ...others } = message.reactions ?? {}
        return { ...message, reactions: emoji ? { ...others, [uid]: emoji } : others }
      })
    },

    async voteInPoll(tripId, messageId, uid, option) {
      updateMessage(tripId, messageId, (message) => {
        const { [uid]: _previous, ...others } = message.votes ?? {}
        return { ...message, votes: option == null ? others : { ...others, [uid]: option } }
      })
    },

    watchChatMeta(tripId, callback) {
      const notify = () => callback(read<ChatMeta>(chatMetaKey(tripId), { read: {}, typing: {} }))
      notify()
      return subscribe(chatMetaKey(tripId), notify)
    },

    async setChatRead(tripId, uid, upTo) {
      const meta = read<ChatMeta>(chatMetaKey(tripId), { read: {}, typing: {} })
      write(chatMetaKey(tripId), { ...meta, read: { ...meta.read, [uid]: upTo } })
    },

    async setTyping(tripId, uid, at) {
      const meta = read<ChatMeta>(chatMetaKey(tripId), { read: {}, typing: {} })
      const { [uid]: _previous, ...others } = meta.typing
      write(chatMetaKey(tripId), { ...meta, typing: at == null ? others : { ...others, [uid]: at } })
    },

    watchPresence(tripId, callback) {
      const notify = () => callback(read<Record<string, Presence>>(presenceKey(tripId), {}))
      notify()
      return subscribe(presenceKey(tripId), notify)
    },

    async setPresence(tripId, uid, presence) {
      const { [uid]: _previous, ...others } = read<Record<string, Presence>>(presenceKey(tripId), {})
      write(presenceKey(tripId), presence ? { ...others, [uid]: presence } : others)
    },

    watchTickets(tripId, callback) {
      const notify = () => callback([...read<Ticket[]>(ticketsKey(tripId), [])].sort((a, b) => b.at - a.at))
      notify()
      return subscribe(ticketsKey(tripId), notify)
    },

    async addTicket(tripId, ticket, pages) {
      await cachePages(ticket.id, pages)
      write(ticketsKey(tripId), [...read<Ticket[]>(ticketsKey(tripId), []), ticket])
    },

    async ticketPages(_tripId, ticket) {
      return (await cachedPages(ticket.id)) ?? []
    },

    async deleteTicket(tripId, ticket) {
      write(
        ticketsKey(tripId),
        read<Ticket[]>(ticketsKey(tripId), []).filter((t) => t.id !== ticket.id),
      )
      await dropPages(ticket.id)
    },
  }
}
