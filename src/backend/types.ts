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

export type Unsubscribe = () => void

/** Personal details from sign-up (private: only the user reads them; trips get the name and gender). */
export interface Profile {
  firstName: string
  lastName: string
  gender: Gender
}

export interface SessionUser {
  uid: string
  /** Username as the user typed it at sign-up (display form). Used to sign in. */
  username: string
  /** Undefined while loading; null for accounts from before profiles (asked to fill it in once). */
  profile?: Profile | null
  /** The recovery e-mail (verified), or null when none was added. */
  email?: string | null
  /** Version of the terms and privacy policy they accepted (null: none yet; undefined: loading). */
  termsVersion?: number | null
  /** When they agreed to the community rules (null: not yet). */
  communityAt?: number | null
}

/** How the user is called in the app: first and last name, or the username before a profile exists. */
export function displayName(user: SessionUser): string {
  return user.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : user.username
}

/** The short, friendly form (greetings, chat): the first name. */
export function firstName(user: SessionUser): string {
  return user.profile?.firstName || user.username
}

/** What a trip stores about a member. */
export function memberOf(user: SessionUser): { name: string; gender?: Gender } {
  // The rules cap names at 60 characters (first and last name are up to 30 each, plus a space).
  return { name: displayName(user).slice(0, 60), ...(user.profile ? { gender: user.profile.gender } : {}) }
}

/** Where a join request stands, seen by the person who sent it. */
export type JoinStatus =
  { state: 'pending'; tripName?: string; ownerName?: string } | { state: 'declined' } | { state: 'member' } | { state: 'none' }

/** What a trip deletion has just finished removing, in order. */
export type DeletePhase = 'chat' | 'invite' | 'places' | 'trip'

export type ErrorCode =
  | 'invalid-username'
  | 'username-taken'
  | 'invalid-credentials'
  | 'weak-password'
  | 'too-many-requests'
  | 'invite-not-found'
  | 'permission-denied'
  | 'network'
  | 'no-recovery-email'
  | 'invalid-email'
  | 'email-in-use'
  | 'trip-limit'
  | 'too-fast'
  | 'link-expired'
  | 'link-invalid'
  | 'unknown'

export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'AppError'
  }
}

const MESSAGES: Record<ErrorCode, string> = {
  'invalid-username': 'שם המשתמש לא תקין',
  'username-taken': 'שם המשתמש הזה כבר תפוס. נסו שם אחר, או התחברו אם זה החשבון שלכם',
  'invalid-credentials': 'שם משתמש או סיסמה שגויים',
  'weak-password': 'הסיסמה צריכה לכלול לפחות 6 תווים',
  'too-many-requests': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות',
  'invite-not-found': 'לא מצאנו טיול עם הקוד הזה',
  'permission-denied': 'אין לכם הרשאה לפעולה הזו',
  network: 'אין חיבור לאינטרנט. נסו שוב',
  'no-recovery-email': 'כדי לאפס סיסמה, הקלידו את המייל לשחזור שהוספתם לחשבון',
  'invalid-email': 'כתובת המייל לא תקינה',
  'email-in-use': 'המייל הזה כבר משמש חשבון אחר',
  'trip-limit': 'בגרסת הבטא אפשר ליצור עד 2 טיולים. אפשר למחוק טיול קיים כדי ליצור חדש',
  'too-fast': 'רגע, אפשר לשלוח הודעה לקהילה פעם בכמה שניות',
  'link-expired': 'הקישור הזה כבר פג תוקף. אפשר לבקש קישור חדש',
  'link-invalid': 'הקישור הזה כבר שומש או שאינו תקין. אפשר לבקש קישור חדש',
  unknown: 'משהו השתבש. נסו שוב',
}

/** Hebrew, user-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message !== error.code ? error.message : MESSAGES[error.code]
  return MESSAGES.unknown
}

/** Beta: trips one person can own at a time. */
export const MAX_OWNED_TRIPS = 2

export interface NewTripInput {
  name: string
  startDate: string
  days: number
}

export type TripPatch = Partial<Pick<Trip, 'name' | 'startDate' | 'days' | 'flights'>>

/**
 * Everything the UI needs from persistence. Two implementations:
 * - `local`: accounts + data in this browser (works with zero setup, no sync between devices)
 * - `cloud`: Firebase Auth + Firestore (shared trips, real-time sync, offline cache)
 */
export interface Backend {
  readonly mode: 'local' | 'cloud'

  onAuthChange(callback: (user: SessionUser | null) => void): Unsubscribe
  /** With the username, or with the recovery e-mail once one was added (then only with it). */
  signIn(usernameOrEmail: string, password: string): Promise<void>
  signUp(username: string, password: string, profile: Profile, termsVersion: number): Promise<void>
  /** Sends a password-reset link to the recovery e-mail typed in. */
  sendPasswordReset(usernameOrEmail: string): Promise<void>
  /** Adds (or changes) the recovery e-mail: a link is sent there, and the e-mail is set once it's opened. */
  setRecoveryEmail(user: SessionUser, email: string, password: string): Promise<void>
  acceptTerms(user: SessionUser, version: number): Promise<void>
  /** A link from one of our e-mails (password reset, confirming an e-mail): checks it, and says which e-mail it's for. */
  checkEmailLink(mode: EmailLinkMode, code: string): Promise<{ email: string | null }>
  /** Acts on the link: sets the new password (reset), or confirms the e-mail. */
  completeEmailLink(mode: EmailLinkMode, code: string, newPassword?: string): Promise<void>
  /** Deletes the account: leaves (or hands over, or deletes) every trip, then removes the user's data. */
  deleteAccount(user: SessionUser, password: string, trips: Trip[]): Promise<void>
  /** Counts one use of an AI feature today; false when the daily limit is already reached. */
  spendUsage(uid: string, day: string, bucket: string, limit: number): Promise<boolean>
  /** Saves the profile and refreshes the name / gender shown in the user's trips. */
  saveProfile(user: SessionUser, profile: Profile, tripIds: string[]): Promise<void>
  signOut(): Promise<void>

  /**
   * `confirmed` is false while the list only comes from the offline cache (a new device may not have
   * the user's trips cached yet), true once it reflects the server (always true in local mode).
   */
  watchTrips(uid: string, callback: (trips: Trip[], confirmed: boolean) => void, onError: (error: AppError) => void): Unsubscribe
  createTrip(user: SessionUser, input: NewTripInput): Promise<string>
  /** Asks to join the trip behind an invite code. Already a member: resolves with `member: true`. */
  requestJoin(user: SessionUser, inviteCode: string): Promise<{ tripId: string; member: boolean; tripName?: string; ownerName?: string }>
  /** The user's own request to that trip (pending / declined / approved → member). */
  watchJoinStatus(tripId: string, uid: string, callback: (status: JoinStatus) => void): Unsubscribe
  cancelJoinRequest(tripId: string, uid: string): Promise<void>
  /** The owner's view: pending requests to their trip. */
  watchJoinRequests(tripId: string, callback: (requests: JoinRequest[]) => void, onError: (error: AppError) => void): Unsubscribe
  approveJoin(tripId: string, request: JoinRequest): Promise<void>
  declineJoin(tripId: string, uid: string): Promise<void>
  /** The owner removes a member from the trip. */
  removeMember(tripId: string, uid: string): Promise<void>
  /** A member (not the owner) leaves the trip. */
  leaveTrip(trip: Trip, uid: string): Promise<void>
  /** The owner hands the trip over to another member. */
  transferTrip(trip: Trip, newOwnerId: string): Promise<void>
  updateTrip(tripId: string, patch: TripPatch): Promise<void>
  /** The owner deletes the trip and everything in it (places, plan, chat, tickets, its invite code). */
  deleteTrip(trip: Trip, onProgress?: (phase: DeletePhase) => void): Promise<void>
  setDayCity(tripId: string, date: string, cityId: string | null): Promise<void>
  /** placeId starts a stay that night, '' ends one, null removes the entry (the night inherits). */
  setStay(tripId: string, date: string, placeId: string | null): Promise<void>

  watchPlaces(tripId: string, callback: (places: Place[]) => void, onError: (error: AppError) => void): Unsubscribe
  savePlace(tripId: string, place: Place): Promise<void>
  /** Deletes a place and applies `planChanges` (the days that referenced it) in one atomic write. */
  deletePlace(tripId: string, placeId: string, planChanges: DayPlan): Promise<void>

  watchPlan(tripId: string, callback: (plan: DayPlan) => void, onError: (error: AppError) => void): Unsubscribe
  /** Replaces the item lists of the given dates; other dates are untouched. */
  updatePlan(tripId: string, changes: DayPlan): Promise<void>

  /** The trip's latest chat messages, oldest first. */
  watchMessages(tripId: string, callback: (messages: ChatMessage[]) => void, onError: (error: AppError) => void): Unsubscribe
  /**
   * Shows the message right away (also offline). In cloud mode the promise settles only once the
   * server has it, so callers shouldn't wait on it; it rejects if the server refuses the message.
   */
  sendMessage(tripId: string, message: Omit<ChatMessage, 'pending'>): Promise<void>
  /** The author takes a message back: it stays as "deleted", without its content. */
  deleteMessage(tripId: string, message: ChatMessage): Promise<void>
  /** Sets (or with null, removes) this member's reaction to a message. */
  reactToMessage(tripId: string, messageId: string, uid: string, emoji: string | null): Promise<void>
  /** Sets (or with null, withdraws) this member's answer to a poll. */
  voteInPoll(tripId: string, messageId: string, uid: string, option: number | null): Promise<void>
  /** Read markers and typing indicators of the trip's members. */
  watchChatMeta(tripId: string, callback: (meta: ChatMeta) => void, onError: (error: AppError) => void): Unsubscribe
  setChatRead(tripId: string, uid: string, upTo: number): Promise<void>
  /** When this member last typed (null: stopped). */
  setTyping(tripId: string, uid: string, at: number | null): Promise<void>

  /** Live positions of the members who share theirs, by uid. */
  watchPresence(tripId: string, callback: (byUid: Record<string, Presence>) => void, onError: (error: AppError) => void): Unsubscribe
  /** Publishes (or with null, withdraws) this member's position. */
  setPresence(tripId: string, uid: string, presence: Presence | null): Promise<void>

  /** The trip's saved entry tickets (without their pages), newest first. */
  watchTickets(tripId: string, callback: (tickets: Ticket[]) => void, onError: (error: AppError) => void): Unsubscribe
  /** Saves a ticket and its pages (JPEG base64, each under TICKET_PAGE_MAX_CHARS). */
  addTicket(tripId: string, ticket: Ticket, pages: string[]): Promise<void>
  /** The ticket's page images (JPEG base64). */
  ticketPages(tripId: string, ticket: Ticket): Promise<string[]>
  deleteTicket(tripId: string, ticket: Ticket): Promise<void>

  /* ── Community (all users) ── */
  /** The room's latest messages, oldest first. */
  watchCommunity(
    channel: CommunityChannel,
    callback: (messages: CommunityMessage[]) => void,
    onError: (error: AppError) => void,
  ): Unsubscribe
  /** Agrees to the community rules (needed before posting). */
  joinCommunity(user: SessionUser): Promise<void>
  postCommunity(user: SessionUser, channel: CommunityChannel, text: string): Promise<void>
  /** Their own message, or any message for a moderator. */
  deleteCommunityMessage(message: CommunityMessage): Promise<void>
  reportCommunityMessage(user: SessionUser, message: CommunityMessage, reason: string): Promise<void>
  /** Moderators may remove any message. */
  isCommunityModerator(uid: string): Promise<boolean>
}

/** What a link in one of our e-mails does (Firebase's "mode"). */
export type EmailLinkMode = 'resetPassword' | 'verifyEmail' | 'verifyAndChangeEmail' | 'recoverEmail'

/** One page per Firestore document, which holds at most 1 MiB. */
export const TICKET_PAGE_MAX_CHARS = 900_000
export const TICKET_MAX_PAGES = 8
