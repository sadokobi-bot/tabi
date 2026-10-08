import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Footprints, LocateFixed, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { directionsUrl } from '@/lib/deeplinks'
import { useNow } from '@/hooks/useNow'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { PRESENCE_FRESH_MS, rememberSharing, usePresence } from '@/store/presence'
import { useCurrentUser } from '@/store/session'
import { useTrip } from '@/store/trip'
import { ui } from '@/store/ui'

/** "2 דק׳ ago", for a shared position. */
export function agoLabel(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000))
  if (minutes < 1) return 'עכשיו'
  if (minutes < 60) return `לפני ${minutes} דק׳`
  return `לפני ${Math.round(minutes / 60)} ש׳`
}

/** Who's where: the trip members' shared positions, and this member's own sharing switch. */
export function PeopleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const trip = useTrip()
  const me = useCurrentUser()
  const byUid = usePresence((state) => state.byUid)
  const sharing = usePresence((state) => state.sharing)
  const now = useNow(30_000).getTime()
  const others = Object.entries(trip.members).filter(([uid]) => uid !== me.uid)

  const toggle = () => {
    const next = !sharing
    rememberSharing(me.uid, trip.id, next)
    ui.toast(next ? 'השותפים יראו איפה אתם כשהאפליקציה פתוחה' : 'הפסקתם לשתף את המיקום')
  }

  // Portaled: the map's tab panel is its own stacking context, under the tab bar.
  return createPortal(
    <BottomSheet open={open} onClose={onClose} label="איפה כולם">
      <div className="px-5 pb-6">
        <header className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
            <Users className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">איפה כולם</h2>
            <p className="text-sm text-muted">מיקום חי של השותפים לטיול</p>
          </div>
        </header>

        <button
          type="button"
          role="switch"
          aria-checked={sharing}
          onClick={toggle}
          className="surface mt-5 flex w-full items-center gap-3 rounded-control p-4 text-start"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">לשתף את המיקום שלי</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">רק השותפים לטיול רואים, ורק בזמן שהאפליקציה פתוחה אצלכם</span>
          </span>
          <span
            aria-hidden
            className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', sharing ? 'bg-accent-fill' : 'bg-fg/15')}
          >
            <span
              className={clsx(
                'absolute top-1 size-5 rounded-full bg-white shadow transition-[inset-inline-start]',
                sharing ? 'start-6' : 'start-1',
              )}
            />
          </span>
        </button>

        <ul className="mt-4 space-y-2">
          {others.length === 0 && <li className="py-6 text-center text-sm text-muted">כשמישהו יצטרף לטיול, תראו כאן איפה הוא נמצא</li>}
          {others.map(([uid, member]) => {
            const presence = byUid[uid]
            const live = presence && now - presence.at < PRESENCE_FRESH_MS
            return (
              <li key={uid} className="surface flex items-center gap-3 rounded-control p-3">
                <Avatar name={member.name} className="size-10 text-base" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{member.name}</p>
                  <p className={clsx('text-xs', live ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted')}>
                    {live ? `משתף מיקום · ${agoLabel(presence.at, now)}` : 'לא משתף מיקום כרגע'}
                  </p>
                </div>
                {live && (
                  <>
                    <button
                      type="button"
                      aria-label={`להציג את ${member.name} במפה`}
                      onClick={() => {
                        ui.moveCamera({ center: presence.location, zoom: 16 })
                        onClose()
                      }}
                      className="tap-target relative grid size-10 place-items-center rounded-full bg-fg/6 text-fg"
                    >
                      <LocateFixed aria-hidden className="size-4.5" />
                    </button>
                    <a
                      href={directionsUrl(presence.location, { mode: 'walking' })}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`ניווט אל ${member.name}`}
                      className="tap-target relative grid size-10 place-items-center rounded-full bg-accent/12 text-accent"
                    >
                      <Footprints aria-hidden className="size-4.5" />
                    </a>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </BottomSheet>,
    document.body,
  )
}
