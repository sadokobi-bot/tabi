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
  arrayUnion,
  collection,
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
import type { ChatMessage, DayPlan, Place, Trip } from '@/data/types'
import { newInviteCode, normalizeInviteCode } from '@/lib/ids'
import { AppError, type Backend, type ErrorCode, type SessionUser } from './types'
import { checkUsername, emailToUsername, usernameToEmail } from './username'

/**
 * Cloud backend: Firebase Auth (username → synthetic e-mail + password) and Firestore.
 *
 * Firestore layout (see firestore.rules):
 *   trips/{tripId}                  Trip (members only)
 *   trips/{tripId}/places/{placeId} Place
 *   trips/{tripId}/meta/plan        { days: DayPlan }
 *   trips/{tripId}/messages/{id}    ChatMessage (members only; create-only)
 *   invites/{code}                  { tripId }  (get by code only, never listable)
 */

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

  // onAuthStateChanged fires before updateProfile() finishes on sign-up, so we re-emit afterwards.
  const authCallbacks = new Set<(user: SessionUser | null) => void>()
  const emitCurrentUser = () => {
    const user = auth.currentUser
    authCallbacks.forEach((callback) => callback(user ? toSession(user) : null))
  }

  const tripRef = (tripId: string) => doc(db, 'trips', tripId)
  const planRef = (tripId: string) => doc(db, 'trips', tripId, 'meta', 'plan')
  const placeRef = (tripId: string, placeId: string) => doc(db, 'trips', tripId, 'places', placeId)

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
    flights: (data.flights as Trip['flights'] | undefined) ?? [],
    createdAt: Number(data.createdAt ?? 0),
  })

  return {
    mode: 'cloud',

    onAuthChange(callback) {
      authCallbacks.add(callback)
      const unsubscribe = onAuthStateChanged(auth, (user) => callback(user ? toSession(user) : null))
      return () => {
        authCallbacks.delete(callback)
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

    async signUp(username, password) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-username', check.reason)
      if (password.length < 6) throw new AppError('weak-password')
      try {
        const credential = await createUserWithEmailAndPassword(auth, usernameToEmail(check.key), password)
        await updateProfile(credential.user, { displayName: check.display })
        emitCurrentUser()
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signOut() {
      await firebaseSignOut(auth)
    },

    watchTrips(uid, callback, onError) {
      const q = query(collection(db, 'trips'), where('memberIds', 'array-contains', uid))
      return onSnapshot(
        q,
        (snapshot) => callback(snapshot.docs.map((d) => normalizeTrip(d.id, d.data())), !snapshot.metadata.fromCache),
        (error) => onError(toAppError(error)),
      )
    },

    async createTrip(user, input, seed) {
      const ref = doc(collection(db, 'trips'))
      const inviteCode = newInviteCode()
      const trip: Omit<Trip, 'id'> = {
        name: input.name,
        startDate: input.startDate,
        days: input.days,
        ownerId: user.uid,
        memberIds: [user.uid],
        members: { [user.uid]: { name: user.username } },
        inviteCode,
        dayCities: seed?.dayCities ?? {},
        flights: [],
        createdAt: Date.now(),
      }
      try {
        const batch = writeBatch(db)
        batch.set(ref, trip)
        batch.set(doc(db, 'invites', inviteCode), { tripId: ref.id })
        batch.set(planRef(ref.id), { days: seed?.plan ?? {} })
        await batch.commit()
        // Places are written one by one: each write is checked against the (now existing) trip membership.
        await Promise.all((seed?.places ?? []).map((place) => setDoc(placeRef(ref.id, place.id), place)))
        return ref.id
      } catch (error) {
        throw toAppError(error)
      }
    },

    async joinTrip(user, inviteCode) {
      try {
        const invite = await getDoc(doc(db, 'invites', normalizeInviteCode(inviteCode)))
        const tripId = invite.exists() ? (invite.data().tripId as string | undefined) : undefined
        if (!tripId) throw new AppError('invite-not-found')
        await updateDoc(tripRef(tripId), {
          memberIds: arrayUnion(user.uid),
          [`members.${user.uid}`]: { name: user.username },
        })
        return tripId
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
  }
}
