import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  FieldPath,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  initializeFirestore,
  limitToLast,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { firebaseConfig } from '@/config/env'
import type { ChatMessage, DayPlan, Gender, JoinRequest, Place, Presence, Ticket, Trip } from '@/data/types'
import { newInviteCode, normalizeInviteCode } from '@/lib/ids'
import { AppError, displayName, memberOf, type Backend, type ErrorCode, type Profile, type SessionUser } from './types'
import { checkUsername, emailToUsername, usernameToEmail } from './username'

/**
 * Cloud backend: Firebase Auth (username → synthetic e-mail + password) and Firestore.
 *
 * Firestore layout (see firestore.rules):
 *   users/{uid}                     Profile (the user only)
 *   trips/{tripId}                  Trip (members only; the owner renames it and decides who's in)
 *   trips/{tripId}/requests/{uid}   join requests (the asker and the owner)
 *   trips/{tripId}/places/{placeId} Place
 *   trips/{tripId}/meta/plan        { days: DayPlan }
 *   trips/{tripId}/messages/{id}    ChatMessage (members only; create-only)
 *   trips/{tripId}/meta/tickets     { [ticketId]: Ticket }
 *   trips/{tripId}/meta/ticket-{id}-{n}  { data }: page n of a ticket (JPEG base64)
 *   invites/{code}                  { tripId, tripName, ownerName }  (get by code only, never listable)
 */

const GENDERS: Gender[] = ['male', 'female', 'other']

function toProfile(data: Record<string, unknown> | undefined): Profile | null {
  if (!data || typeof data.firstName !== 'string' || typeof data.lastName !== 'string') return null
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    gender: GENDERS.includes(data.gender as Gender) ? (data.gender as Gender) : 'other',
  }
}

/** How many recent chat messages are kept in sync. */
const MESSAGE_LIMIT = 300

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const code = (error as { code?: string } | null)?.code ?? ''
  const map: Record<string, ErrorCode> = {
    'auth/email-already-in-use': 'username-taken',
    'auth/invalid-credential': 'invalid-credentials',
    'auth/invalid-login-credentials': 'invalid-credentials',
    'auth/wrong-password': 'invalid-credentials',
    'auth/user-not-found': 'invalid-credentials',
    'auth/invalid-email': 'invalid-credentials',
    'auth/weak-password': 'weak-password',
    'auth/password-does-not-meet-requirements': 'weak-password',
    'auth/too-many-requests': 'too-many-requests',
    'auth/network-request-failed': 'network',
    'permission-denied': 'permission-denied',
    unavailable: 'network',
  }
  return new AppError(map[code] ?? 'unknown')
}

export function createFirebaseBackend(): Backend {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  // Persistent cache: the trip keeps working offline (subway, flights) and syncs when back online.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  })

  const toSession = (user: User): SessionUser => ({
    uid: user.uid,
    username: user.displayName || emailToUsername(user.email ?? ''),
  })

  // onAuthStateChanged fires before updateProfile() finishes on sign-up, so listeners re-emit afterwards.
  const reemitters = new Set<() => void>()
  const emitCurrentUser = () => reemitters.forEach((reemit) => reemit())

  const profileRef = (uid: string) => doc(db, 'users', uid)
  const requestRef = (tripId: string, uid: string) => doc(db, 'trips', tripId, 'requests', uid)
  const tripRef = (tripId: string) => doc(db, 'trips', tripId)
  const planRef = (tripId: string) => doc(db, 'trips', tripId, 'meta', 'plan')
  // One small doc per trip: members may write meta docs (see firestore.rules), so no rule change is needed.
  const presenceRef = (tripId: string) => doc(db, 'trips', tripId, 'meta', 'presence')
  const placeRef = (tripId: string, placeId: string) => doc(db, 'trips', tripId, 'places', placeId)
  // Tickets live in meta docs too (members read and write them): an index, and one doc per page.
  const ticketsRef = (tripId: string) => doc(db, 'trips', tripId, 'meta', 'tickets')
  const ticketPageRef = (tripId: string, ticketId: string, page: number) => doc(db, 'trips', tripId, 'meta', `ticket-${ticketId}-${page}`)

  const normalizeTrip = (id: string, data: Record<string, unknown>): Trip => ({
    id,
    name: String(data.name ?? ''),
    startDate: String(data.startDate ?? ''),
    days: Number(data.days ?? 30),
    ownerId: String(data.ownerId ?? ''),
    memberIds: (data.memberIds as string[] | undefined) ?? [],
    members: (data.members as Trip['members'] | undefined) ?? {},
    inviteCode: String(data.inviteCode ?? ''),
    dayCities: (data.dayCities as Trip['dayCities'] | undefined) ?? {},
    stays: (data.stays as Trip['stays'] | undefined) ?? {},
    flights: (data.flights as Trip['flights'] | undefined) ?? [],
    createdAt: Number(data.createdAt ?? 0),
  })

  return {
    mode: 'cloud',

    onAuthChange(callback) {
      // The user, then again with their profile once it's read (undefined = still loading,
      // null = the server says there is none: an account from before profiles).
      let profile: Profile | null | undefined
      let stopProfile: (() => void) | null = null
      const emit = () => {
        const user = auth.currentUser
        callback(user ? { ...toSession(user), profile } : null)
      }
      reemitters.add(emit)
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        stopProfile?.()
        stopProfile = null
        profile = undefined
        emit()
        if (!user) return
        stopProfile = onSnapshot(
          profileRef(user.uid),
          (snapshot) => {
            // Missing from the offline cache isn't missing: wait for the server before asking for details.
            if (!snapshot.exists() && snapshot.metadata.fromCache) return
            profile = toProfile(snapshot.data())
            emit()
          },
          (error) => {
            console.warn('[profile] not readable', error)
            profile = null
            emit()
          },
        )
      })
      return () => {
        reemitters.delete(emit)
        stopProfile?.()
        unsubscribe()
      }
    },

    async signIn(username, password) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-credentials')
      try {
        await signInWithEmailAndPassword(auth, usernameToEmail(check.key), password)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signUp(username, password, profile) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-username', check.reason)
      if (password.length < 6) throw new AppError('weak-password')
      try {
        const credential = await createUserWithEmailAndPassword(auth, usernameToEmail(check.key), password)
        await updateProfile(credential.user, { displayName: check.display })
        await setDoc(profileRef(credential.user.uid), { ...profile, updatedAt: Date.now() })
        emitCurrentUser()
      } catch (error) {
        throw toAppError(error)
      }
    },

    async saveProfile(user, profile, tripIds) {
      try {
        await setDoc(profileRef(user.uid), { ...profile, updatedAt: Date.now() })
        // Members may update their own entry in their trips (name and gender).
        const member = memberOf({ ...user, profile })
        await Promise.all(tripIds.map((tripId) => updateDoc(tripRef(tripId), { [`members.${user.uid}`]: member }).catch(() => undefined)))
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signOut() {
      await firebaseSignOut(auth)
    },

    watchTrips(uid, callback, onError) {
      const q = query(collection(db, 'trips'), where('memberIds', 'array-contains', uid))
      // Metadata changes too: when the user is removed from a trip, the list can first drop it from the
      // cache and only then be confirmed by the server, with no change to the documents themselves. Without
      // them that confirmation never arrives, and the app waits forever instead of offering a new trip.
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) =>
          callback(
            snapshot.docs.map((d) => normalizeTrip(d.id, d.data())),
            !snapshot.metadata.fromCache,
          ),
        (error) => onError(toAppError(error)),
      )
    },

    async createTrip(user, input) {
      const ref = doc(collection(db, 'trips'))
      const inviteCode = newInviteCode()
      const trip: Omit<Trip, 'id'> = {
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
      const write = (invite: Record<string, string>) => {
        const batch = writeBatch(db)
        batch.set(ref, trip)
        batch.set(doc(db, 'invites', inviteCode), invite)
        batch.set(planRef(ref.id), { days: {} })
        return batch.commit()
      }
      try {
        // The invite carries the trip and owner names, so whoever asks to join sees what they're joining.
        await write({ tripId: ref.id, tripName: input.name, ownerName: displayName(user) }).catch((error: unknown) => {
          // Rules from before join requests only accept { tripId }.
          if ((error as { code?: string }).code !== 'permission-denied') throw error
          return write({ tripId: ref.id })
        })
        return ref.id
      } catch (error) {
        throw toAppError(error)
      }
    },

    async requestJoin(user, inviteCode) {
      try {
        const invite = await getDoc(doc(db, 'invites', normalizeInviteCode(inviteCode)))
        const data = invite.exists() ? invite.data() : undefined
        const tripId = data?.tripId as string | undefined
        if (!tripId) throw new AppError('invite-not-found')
        const names = {
          ...(typeof data?.tripName === 'string' ? { tripName: data.tripName } : {}),
          ...(typeof data?.ownerName === 'string' ? { ownerName: data.ownerName } : {}),
        }
        // Only members can read a trip: if this read works, we're already in.
        const member = await getDoc(tripRef(tripId)).then(
          (trip) => trip.exists() && ((trip.data().memberIds as string[] | undefined) ?? []).includes(user.uid),
          () => false,
        )
        if (member) return { tripId, member: true, ...names }
        await setDoc(requestRef(tripId, user.uid), { ...memberOf(user), at: Date.now(), status: 'pending' })
        return { tripId, member: false, ...names }
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchJoinStatus(tripId, uid, callback) {
      return onSnapshot(
        requestRef(tripId, uid),
        (snapshot) => {
          // A cache miss isn't an answer (a new device, a cleared cache): wait for the server.
          if (!snapshot.exists()) {
            if (!snapshot.metadata.fromCache) callback({ state: 'none' })
          } else callback(snapshot.data().status === 'declined' ? { state: 'declined' } : { state: 'pending' })
        },
        () => callback({ state: 'none' }),
      )
    },

    async cancelJoinRequest(tripId, uid) {
      try {
        await deleteDoc(requestRef(tripId, uid))
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchJoinRequests(tripId, callback, onError) {
      return onSnapshot(
        collection(db, 'trips', tripId, 'requests'),
        (snapshot) =>
          callback(
            snapshot.docs
              .map((d) => ({ ...(d.data() as Omit<JoinRequest, 'uid'>), uid: d.id }))
              .filter((request) => request.status === 'pending')
              .sort((a, b) => a.at - b.at),
          ),
        (error) => onError(toAppError(error)),
      )
    },

    async approveJoin(tripId, request) {
      try {
        const batch = writeBatch(db)
        batch.update(tripRef(tripId), {
          memberIds: arrayUnion(request.uid),
          [`members.${request.uid}`]: { name: request.name, ...(request.gender ? { gender: request.gender } : {}) },
        })
        batch.delete(requestRef(tripId, request.uid))
        await batch.commit()
      } catch (error) {
        throw toAppError(error)
      }
    },

    async declineJoin(tripId, uid) {
      try {
        await updateDoc(requestRef(tripId, uid), { status: 'declined' })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async removeMember(tripId, uid) {
      try {
        await updateDoc(tripRef(tripId), { memberIds: arrayRemove(uid), [`members.${uid}`]: deleteField() })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async updateTrip(tripId, patch) {
      try {
        await updateDoc(tripRef(tripId), patch)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async setDayCity(tripId, date, cityId) {
      try {
        await updateDoc(tripRef(tripId), new FieldPath('dayCities', date), cityId ?? deleteField())
      } catch (error) {
        throw toAppError(error)
      }
    },

    async setStay(tripId, date, placeId) {
      try {
        await updateDoc(tripRef(tripId), new FieldPath('stays', date), placeId ?? deleteField())
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchPlaces(tripId, callback, onError) {
      return onSnapshot(
        collection(db, 'trips', tripId, 'places'),
        (snapshot) => callback(snapshot.docs.map((d) => ({ ...(d.data() as Place), id: d.id }))),
        (error) => onError(toAppError(error)),
      )
    },

    async savePlace(tripId, place) {
      try {
        await setDoc(placeRef(tripId, place.id), place)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async deletePlace(tripId, placeId, planChanges) {
      try {
        const batch = writeBatch(db)
        batch.delete(placeRef(tripId, placeId))
        if (Object.keys(planChanges).length > 0) batch.set(planRef(tripId), { days: planChanges }, { merge: true })
        await batch.commit()
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchPlan(tripId, callback, onError) {
      return onSnapshot(
        planRef(tripId),
        (snapshot) => callback(((snapshot.data()?.days as DayPlan | undefined) ?? {}) satisfies DayPlan),
        (error) => onError(toAppError(error)),
      )
    },

    async updatePlan(tripId, changes) {
      try {
        // merge: replaces only the listed dates' arrays, leaving every other day untouched.
        await setDoc(planRef(tripId), { days: changes }, { merge: true })
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchMessages(tripId, callback, onError) {
      const q = query(collection(db, 'trips', tripId, 'messages'), orderBy('createdAt'), limitToLast(MESSAGE_LIMIT))
      // Metadata changes too: a message sent offline flips from "pending" to delivered without other edits.
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) =>
          callback(
            snapshot.docs.map((d) => ({
              ...(d.data() as Omit<ChatMessage, 'id' | 'pending'>),
              id: d.id,
              pending: d.metadata.hasPendingWrites,
            })),
          ),
        (error) => onError(toAppError(error)),
      )
    },

    async sendMessage(tripId, { id, ...message }) {
      try {
        await setDoc(doc(db, 'trips', tripId, 'messages', id), message)
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchPresence(tripId, callback, onError) {
      return onSnapshot(
        presenceRef(tripId),
        (snapshot) => callback((snapshot.data() as Record<string, Presence> | undefined) ?? {}),
        (error) => onError(toAppError(error)),
      )
    },

    async setPresence(tripId, uid, presence) {
      try {
        await setDoc(presenceRef(tripId), { [uid]: presence ?? deleteField() }, { merge: true })
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchTickets(tripId, callback, onError) {
      return onSnapshot(
        ticketsRef(tripId),
        (snapshot) => callback(Object.values((snapshot.data() as Record<string, Ticket> | undefined) ?? {}).sort((a, b) => b.at - a.at)),
        (error) => onError(toAppError(error)),
      )
    },

    async addTicket(tripId, ticket, pages) {
      try {
        // Pages first, the index last: nobody sees a ticket whose pages aren't there yet.
        const batch = writeBatch(db)
        pages.forEach((data, page) => batch.set(ticketPageRef(tripId, ticket.id, page), { data }))
        batch.set(ticketsRef(tripId), { [ticket.id]: ticket }, { merge: true })
        await batch.commit()
      } catch (error) {
        throw toAppError(error)
      }
    },

    async ticketPages(tripId, ticket) {
      try {
        const snapshots = await Promise.all(
          Array.from({ length: ticket.pages }, (_, page) => getDoc(ticketPageRef(tripId, ticket.id, page))),
        )
        return snapshots.map((snapshot) => String(snapshot.data()?.data ?? ''))
      } catch (error) {
        throw toAppError(error)
      }
    },

    async deleteTicket(tripId, ticket) {
      try {
        const batch = writeBatch(db)
        batch.set(ticketsRef(tripId), { [ticket.id]: deleteField() }, { merge: true })
        for (let page = 0; page < ticket.pages; page++) batch.delete(ticketPageRef(tripId, ticket.id, page))
        await batch.commit()
      } catch (error) {
        throw toAppError(error)
      }
    },
  }
}
