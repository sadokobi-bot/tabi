import { motion } from 'motion/react'
import { MeetCard } from './ChatCards'
import { currentMeet } from '@/data/chat'
import type { ChatMessage, Trip } from '@/data/types'
import { useNow } from '@/hooks/useNow'
import { byGender } from '@/lib/hebrew'
import { useTripStore } from '@/store/trip'

/** Someone stopped typing if they haven't for this long (they may have closed the app). */
const TYPING_FRESH_MS = 6000

/** "נועה מקלידה…" while another member is writing. */
export function TypingIndicator({ trip, uid }: { trip: Trip; uid: string }) {
  const typing = useTripStore((state) => state.chatMeta.typing)
  const now = useNow(1000).getTime()
  const who = Object.entries(typing).flatMap(([member, at]) =>
    member !== uid && now - at < TYPING_FRESH_MS && trip.memberIds.includes(member) ? [member] : [],
  )
  if (who.length === 0) return null

  const name = (member: string) => (trip.members[member]?.name ?? 'מישהו').split(' ')[0]
  const text =
    who.length === 1
      ? `${name(who[0]!)} ${byGender(trip.members[who[0]!]?.gender, { male: 'מקליד', female: 'מקלידה' })}`
      : `${who.map(name).join(' ו')} מקלידים`

  return (
    <p role="status" className="flex items-center gap-1.5 px-5 pb-1 text-xs text-muted">
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="size-1 rounded-full bg-current"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: dot * 0.18 }}
          />
        ))}
      </span>
      {text}…
    </p>
  )
}

/** The latest meeting point, pinned until a little after its time. */
export function PinnedMeet({ messages }: { messages: ChatMessage[] }) {
  const now = useNow(30_000).getTime()
  const message = currentMeet(messages, now)
  if (!message?.meet) return null
  return (
    <section aria-label="נקודת מפגש" className="surface rounded-card p-2.5 shadow-sm">
      <MeetCard meet={message.meet} compact />
      {message.text && (
        <p className="mt-1.5 ps-14 text-xs text-muted" dir="auto">
          {message.text}
        </p>
      )}
    </section>
  )
}
