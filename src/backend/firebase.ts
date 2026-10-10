import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import {
  EmailAuthProvider,
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
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
  getDocs,
  runTransaction,
  initializeFirestore,
  limit,
  limitToLast,
  serverTimestamp,
  Timestamp,
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
import { firebaseConfig, RECAPTCHA_SITE_KEY } from '@/config/env'
import type {
  ChatMessage,
  ChatMeta,
  CommunityChannel,
  CommunityMessage,
  DayPlan,
  Gender,
  JoinRequest,
  Place,
  Presence,
  Ticket,
  Trip,
} from '@/data/types'
import { newInviteCode, normalizeInviteCode } from '@/lib/ids'
import { AppError, displayName, memberOf, type Backend, type ErrorCode, type Profile, type SessionUser } from './types'
import { checkUsername, emailToUsername, isUsernameEmail, usernameToEmail } from './username'

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

const COMMUNITY_CHANNELS: CommunityChannel[] = ['general', 'tips']
/** How many of a community room's latest messages are shown. */
const COMMUNITY_LIMIT = 150

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const code = (error as { code?: string } | null)?.code ?? ''
  const map: Record<string, ErrorCode> = {
    'auth/email-already-in-use': 'username-taken',
    'auth/requires-recent-login': 'invalid-credentials',
    'auth/expired-action-code': 'link-expired',
    'auth/invalid-action-code': 'link-invalid',
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

const EMAIL_WORKER = 'https://tabi-email.sadokobi.workers.dev'

async function sendStyledEmail(type: 'verifyEmail' | 'resetPassword', email: string, displayName?: string) {
  try {
    await fetch(EMAIL_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, email, displayName }),
    })
  } catch {
    // The Worker email is best-effort; Firebase's own email is the fallback.
  }
}

export function createFirebaseBackend(): Backend {
  const app = initializeApp(firebaseConfig)
  // App Check (reCAPTCHA Enterprise / Fraud Defense): only this app, on its own site, may use the project's AI and data. Off until a key is set.
  if (RECAPTCHA_SITE_KEY) {
    initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true })
  }
  const auth = getAuth(app)
  // Persistent cache: the trip keeps working offline (subway, flights) and syncs when back online.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  })

  const toSession = (user: User): SessionUser => ({
    uid: user.uid,
    username: user.displayName || emailToUsername(user.email ?? ''),
    email: isUsernameEmail(user.email) ? null : user.email,
  })
  const usageRef = (uid: string, day: string) => doc(db, 'users', uid, 'usage', day)

  /** Confirms it's really them (Firebase asks for a fresh sign-in before sensitive changes). */
  const reauthenticate = async (password: string) => {
    const current = auth.currentUser
    if (!current?.email) throw new AppError('unknown')
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password))
    return current
  }

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
  // Read markers and typing: one small meta doc (members write meta docs, no rule change needed).
  const chatMetaRef = (tripId: string) => doc(db, 'trips', tripId, 'meta', 'chat')
  const messageRef = (tripId: string, messageId: string) => doc(db, 'trips', tripId, 'messages', messageId)
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
      let termsVersion: number | null | undefined
      let communityAt: number | null | undefined
      let stopProfile: (() => void) | null = null
      const emit = () => {
        const user = auth.currentUser
        callback(user ? { ...toSession(user), profile, termsVersion, communityAt } : null)
      }
      reemitters.add(emit)
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        stopProfile?.()
        stopProfile = null
        profile = undefined
        termsVersion = undefined
        emit()
        if (!user) return
        stopProfile = onSnapshot(
          profileRef(user.uid),
          (snapshot) => {
            // Missing from the offline cache isn't missing: wait for the server before asking for details.
            if (!snapshot.exists() && snapshot.metadata.fromCache) return
            profile = toProfile(snapshot.data())
            const accepted = snapshot.data()?.termsVersion
            termsVersion = typeof accepted === 'number' ? accepted : null
            const joined = snapshot.data()?.communityAt
            communityAt = typeof joined === 'number' ? joined : null
            emit()
          },
          (error) => {
            console.warn('[profile] not readable', error)
            profile = null
            termsVersion = null
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

    async signIn(usernameOrEmail, password) {
      const typed = usernameOrEmail.trim()
      try {
        if (typed.includes('@')) {
          await signInWithEmailAndPassword(auth, typed, password)
          return
        }
        const check = checkUsername(typed)
        if (!check.ok) throw new AppError('invalid-credentials')
        await signInWithEmailAndPassword(auth, usernameToEmail(check.key), password)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async sendPasswordReset(usernameOrEmail) {
      const typed = usernameOrEmail.trim()
      try {
        if (!typed.includes('@')) throw new AppError('no-recovery-email')
        await sendStyledEmail('resetPassword', typed, auth.currentUser?.displayName ?? undefined)
      } catch (error) {
        const code = (error as { code?: string } | null)?.code
        if (code === 'auth/invalid-email') throw new AppError('invalid-email')
        if (code === 'auth/user-not-found') return
        throw toAppError(error)
      }
    },

    async setRecoveryEmail(_user, email, password) {
      try {
        const current = await reauthenticate(password)
        auth.languageCode = 'he'
        await verifyBeforeUpdateEmail(current, email.trim(), { url: 'https://tabijap.com', handleCodeInApp: false })
      } catch (error) {
        const code = (error as { code?: string } | null)?.code
        if (code === 'auth/invalid-email') throw new AppError('invalid-email')
        if (code === 'auth/email-already-in-use') throw new AppError('email-in-use')
        throw toAppError(error)
      }
    },

    async checkEmailLink(mode, code) {
      try {
        if (mode === 'resetPassword') return { email: await verifyPasswordResetCode(auth, code) }
        const info = await checkActionCode(auth, code)
        return { email: info.data.email ?? null }
      } catch (error) {
        throw toAppError(error)
      }
    },

    async completeEmailLink(mode, code, newPassword) {
      try {
        if (mode === 'resetPassword') {
          if (!newPassword || newPassword.length < 6) throw new AppError('weak-password')
          await confirmPasswordReset(auth, code, newPassword)
        } else await applyActionCode(auth, code)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async acceptTerms(user, version) {
      try {
        await setDoc(profileRef(user.uid), { termsVersion: version, termsAt: Date.now() }, { merge: true })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async spendUsage(uid, day, bucket, limit) {
      try {
        return await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(usageRef(uid, day))
          const used = Number(snapshot.data()?.[bucket] ?? 0)
          if (used >= limit) return false
          transaction.set(usageRef(uid, day), { [bucket]: used + 1 }, { merge: true })
          return true
        })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async deleteAccount(user, password, trips) {
      try {
        const current = await reauthenticate(password)
        // Their community messages go with the account.
        for (const channel of COMMUNITY_CHANNELS) {
          const mine = await getDocs(query(collection(db, 'community', channel, 'messages'), where('uid', '==', user.uid)))
          await Promise.all(mine.docs.map((d) => deleteDoc(d.ref)))
        }
        await deleteDoc(doc(db, 'communityPosters', user.uid)).catch(() => undefined)
        for (const trip of trips) {
          if (trip.ownerId !== user.uid) await this.leaveTrip(trip, user.uid)
          else {
            const heir = trip.memberIds.find((id) => id !== user.uid)
            if (heir) {
              await this.transferTrip(trip, heir)
              await this.leaveTrip({ ...trip, ownerId: heir }, user.uid)
            } else await this.deleteTrip(trip)
          }
        }
        await deleteDoc(profileRef(user.uid))
        await deleteUser(current)
      } catch (error) {
        throw toAppError(error)
      }
    },

    async signUp(username, password, profile, termsVersion) {
      const check = checkUsername(username)
      if (!check.ok) throw new AppError('invalid-username', check.reason)
      if (password.length < 6) throw new AppError('weak-password')
      try {
        const credential = await createUserWithEmailAndPassword(auth, usernameToEmail(check.key), password)
        await updateProfile(credential.user, { displayName: check.display })
        await setDoc(profileRef(credential.user.uid), { ...profile, updatedAt: Date.now(), termsVersion, termsAt: Date.now() })
        emitCurrentUser()
      } catch (error) {
        throw toAppError(error)
      }
    },

    async saveProfile(user, profile, tripIds) {
      try {
        // Merge: the profile doc also keeps which terms they accepted.
        await setDoc(profileRef(user.uid), { ...profile, updatedAt: Date.now() }, { merge: true })
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

    async leaveTrip(trip, uid) {
      try {
        // Their live location goes with them.
        await setDoc(presenceRef(trip.id), { [uid]: deleteField() }, { merge: true }).catch(() => undefined)
        await updateDoc(tripRef(trip.id), { memberIds: arrayRemove(uid), [`members.${uid}`]: deleteField() })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async transferTrip(trip, newOwnerId) {
      try {
        const batch = writeBatch(db)
        batch.update(tripRef(trip.id), { ownerId: newOwnerId })
        // The invite shows whose approval a join waits for.
        if (trip.inviteCode)
          batch.set(doc(db, 'invites', trip.inviteCode), { ownerName: trip.members[newOwnerId]?.name ?? '' }, { merge: true })
        await batch.commit()
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

    async deleteTrip(trip, onProgress) {
      if (!navigator.onLine) throw new AppError('network')
      try {
        const docsOf = async (name: string) => (await getDocs(collection(db, 'trips', trip.id, name))).docs.map((d) => d.ref)
        const remove = async (refs: ReturnType<typeof doc>[]) => {
          for (let i = 0; i < refs.length; i += 400) {
            const batch = writeBatch(db)
            refs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
            await batch.commit()
          }
        }
        // The chat first: deleting messages is the newest rule, so with older rules this stops before
        // anything is lost. The trip document goes last (the other rules read it).
        await remove(await docsOf('messages'))
        onProgress?.('chat')
        if (trip.inviteCode) await remove([doc(db, 'invites', trip.inviteCode)])
        onProgress?.('invite')
        await remove([...(await docsOf('requests')), ...(await docsOf('places')), ...(await docsOf('meta'))])
        onProgress?.('places')
        await deleteDoc(tripRef(trip.id))
        onProgress?.('trip')
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

    watchCommunity(channel, callback, onError) {
      const q = query(collection(db, 'community', channel, 'messages'), orderBy('at', 'desc'), limit(COMMUNITY_LIMIT))
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) =>
          callback(
            snapshot.docs
              .map((d): CommunityMessage => {
                const data = d.data()
                return {
                  id: d.id,
                  channel,
                  authorId: String(data.uid ?? ''),
                  authorName: String(data.name ?? ''),
                  text: String(data.text ?? ''),
                  // A message just sent has no server time yet.
                  createdAt: data.at instanceof Timestamp ? data.at.toMillis() : Date.now(),
                  pending: d.metadata.hasPendingWrites,
                }
              })
              .reverse(),
          ),
        (error) => onError(toAppError(error)),
      )
    },

    async joinCommunity(user) {
      try {
        await setDoc(profileRef(user.uid), { communityAt: Date.now() }, { merge: true })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async postCommunity(user, channel, text) {
      try {
        // The poster's "last sent" moves with every message: the rules allow one every few seconds.
        const batch = writeBatch(db)
        batch.set(doc(db, 'communityPosters', user.uid), { last: serverTimestamp() })
        batch.set(doc(collection(db, 'community', channel, 'messages')), {
          uid: user.uid,
          name: user.profile?.firstName ?? user.username,
          text,
          at: serverTimestamp(),
        })
        await batch.commit()
      } catch (error) {
        const appError = toAppError(error)
        throw appError.code === 'permission-denied' ? new AppError('too-fast') : appError
      }
    },

    async deleteCommunityMessage(message) {
      try {
        await deleteDoc(doc(db, 'community', message.channel, 'messages', message.id))
      } catch (error) {
        throw toAppError(error)
      }
    },

    async reportCommunityMessage(user, message, reason) {
      try {
        await setDoc(doc(collection(db, 'community', message.channel, 'reports')), {
          messageId: message.id,
          authorId: message.authorId,
          text: message.text.slice(0, 1000),
          reporter: user.uid,
          reason: reason.slice(0, 200),
          at: serverTimestamp(),
        })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async isCommunityModerator(uid) {
      try {
        return (await getDoc(doc(db, 'admins', uid))).exists()
      } catch {
        return false
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

    async deleteMessage(tripId, message) {
      try {
        // Replaces the whole message: nothing of what it said is kept.
        await setDoc(messageRef(tripId, message.id), {
          authorId: message.authorId,
          authorName: message.authorName,
          createdAt: message.createdAt,
          text: '',
          deleted: true,
        })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async reactToMessage(tripId, messageId, uid, emoji) {
      try {
        await updateDoc(messageRef(tripId, messageId), new FieldPath('reactions', uid), emoji ?? deleteField())
      } catch (error) {
        throw toAppError(error)
      }
    },

    async voteInPoll(tripId, messageId, uid, option) {
      try {
        await updateDoc(messageRef(tripId, messageId), new FieldPath('votes', uid), option ?? deleteField())
      } catch (error) {
        throw toAppError(error)
      }
    },

    watchChatMeta(tripId, callback, onError) {
      return onSnapshot(
        chatMetaRef(tripId),
        (snapshot) => {
          const data = snapshot.data() as Partial<ChatMeta> | undefined
          callback({ read: data?.read ?? {}, typing: data?.typing ?? {} })
        },
        (error) => onError(toAppError(error)),
      )
    },

    async setChatRead(tripId, uid, upTo) {
      try {
        await setDoc(chatMetaRef(tripId), { read: { [uid]: upTo } }, { merge: true })
      } catch (error) {
        throw toAppError(error)
      }
    },

    async setTyping(tripId, uid, at) {
      try {
        await setDoc(chatMetaRef(tripId), { typing: { [uid]: at ?? deleteField() } }, { merge: true })
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
