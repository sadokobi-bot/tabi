import type { ChatMessage, DayPlan, Place, Presence, Trip } from '@/data/types'
import { newId, newInviteCode, normalizeInviteCode } from '@/lib/ids'
import { AppError, type Backend, type SessionUser } from './types'
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

export function createLocalBackend(): Backend {
  return {
    mode: 'local',

    onAuthChange(callback) {
      const notify = () => {
        const uid = read<string | null>('session', null)
        const user = uid ? Object.values(read<Record<string, LocalUser>>('users', {})).find((u) => u.uid === uid) : undefined
        callback(user ? ({ uid: user.uid, username: user.username } satisfies SessionUser) : null)
      }
      notify()
      return subscribe('session', notify)
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

    async signUp(username, password) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-username', check.reason)
      if (password.length < 6) throw new AppError('weak-password')
      const users = read<Record<string, LocalUser>>('users', {})
      if (users[check.key]) throw new AppError('username-taken')
      const { salt, hash } = await hashPassword(password)
      const uid = newId()
      users[check.key] = { uid, username: check.display, salt, hash, createdAt: Date.now() }
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
        members: { [user.uid]: { name: user.username } },
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

    async joinTrip(user, inviteCode) {
      const tripId = read<Record<string, string>>(invitesKey, {})[normalizeInviteCode(inviteCode)]
      if (!tripId || !readTrips()[tripId]) throw new AppError('invite-not-found')
      updateTripRecord(tripId, (trip) =>
        trip.memberIds.includes(user.uid)
          ? trip
          : {
              ...trip,
              memberIds: [...trip.memberIds, user.uid],
              members: { ...trip.members, [user.uid]: { name: user.username } },
            },
      )
      return tripId
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

    watchPresence(tripId, callback) {
      const notify = () => callback(read<Record<string, Presence>>(presenceKey(tripId), {}))
      notify()
      return subscribe(presenceKey(tripId), notify)
    },

    async setPresence(tripId, uid, presence) {
      const { [uid]: _previous, ...others } = read<Record<string, Presence>>(presenceKey(tripId), {})
      write(presenceKey(tripId), presence ? { ...others, [uid]: presence } : others)
    },
  }
}
