import { useState } from 'react'
import clsx from 'clsx'
import { DoorOpen } from 'lucide-react'
import { errorMessage } from '@/backend'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import type { Trip } from '@/data/types'
import { getBackend } from '@/store/session'
import { leftTrips } from '@/store/trip'
import { ui } from '@/store/ui'

/**
 * Leaving the trip. A member just leaves; the owner first hands the trip to another member
 * (alone in it, the owner deletes it instead).
 */
export function LeaveTrip({ trip, uid, onLeft }: { trip: Trip; uid: string; onLeft: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const others = trip.memberIds.filter((id) => id !== uid)
  const isOwner = trip.ownerId === uid
  const [heir, setHeir] = useState<string | null>(others.length === 1 ? others[0]! : null)

  if (isOwner && others.length === 0) return null

  const leave = async () => {
    if (isOwner && !heir) return
    setBusy(true)
    leftTrips.add(trip.id)
    try {
      if (isOwner) await getBackend().transferTrip(trip, heir!)
      await getBackend().leaveTrip(isOwner ? { ...trip, ownerId: heir! } : trip, uid)
      onLeft()
      ui.toast(`עזבתם את הטיול ״${trip.name}״`)
    } catch (error) {
      leftTrips.delete(trip.id)
      ui.toast(errorMessage(error), 'error')
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-control py-2.5 text-sm font-medium text-muted hover:bg-fg/6 hover:text-fg"
      >
        <DoorOpen aria-hidden className="size-4" />
        עזיבת הטיול
      </button>
    )

  return (
    <div role="alertdialog" aria-label="עזיבת הטיול" className="surface mt-3 rounded-card p-4">
      <p className="font-semibold">
        לעזוב את ״<bdi>{trip.name}</bdi>״?
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        הטיול ייעלם מהרשימה שלכם, והמיקום שלכם כבר לא יוצג לשותפים. המקומות וההודעות שהוספתם יישארו להם. כדי לחזור, תצטרכו קוד הזמנה ואישור
        מחדש.
      </p>
      {isOwner && (
        <>
          <p className="mt-3 text-sm font-semibold">מי ינהל את הטיול במקומכם?</p>
          <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
            {others.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={heir === id}
                onClick={() => setHeir(id)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border py-1 ps-1 pe-3 text-sm transition',
                  heir === id ? 'border-accent bg-accent/10 font-semibold' : 'border-line hover:bg-fg/5',
                )}
              >
                <Avatar name={trip.members[id]?.name ?? '?'} className="size-6 text-[11px]" />
                {trip.members[id]?.name ?? 'משתתף'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">הוא או היא יאשרו מצטרפים חדשים ויוכלו לשנות את פרטי הטיול.</p>
        </>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="danger" className="flex-1" disabled={isOwner && !heir} loading={busy} onClick={() => void leave()}>
          {isOwner ? 'העברה ועזיבה' : 'עזיבה'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </div>
  )
}
