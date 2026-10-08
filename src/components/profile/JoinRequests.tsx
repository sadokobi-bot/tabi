import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { errorMessage } from '@/backend'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import type { JoinRequest } from '@/data/types'
import { byGender } from '@/lib/hebrew'
import { getBackend } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/** The owner's pending join requests, each with approve / decline. Renders nothing when there are none. */
export function JoinRequests({ variant = 'card' }: { variant?: 'card' | 'plain' }) {
  const trip = useTrip()
  const requests = useTripStore((state) => state.joinRequests)
  const [busy, setBusy] = useState<string | null>(null)
  if (requests.length === 0) return null

  const decide = async (request: JoinRequest, approve: boolean) => {
    setBusy(request.uid)
    try {
      if (approve) {
        await getBackend().approveJoin(trip.id, request)
        ui.toast(`${request.name} ${byGender(request.gender, { male: 'הצטרף', female: 'הצטרפה' })} לטיול`)
      } else {
        await getBackend().declineJoin(trip.id, request.uid)
      }
    } catch (error) {
      ui.toast(errorMessage(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="בקשות הצטרפות" className={variant === 'card' ? 'surface rounded-card p-4' : ''}>
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <UserPlus aria-hidden className="size-4.5 text-accent" />
        {requests.length === 1 ? 'בקשת הצטרפות' : `${requests.length} בקשות הצטרפות`}
      </h2>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.uid}>
            <div className="flex items-center gap-3">
              <Avatar name={request.name} className="size-10 text-base" />
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <span className="font-semibold">{request.name}</span> {byGender(request.gender, { male: 'מבקש', female: 'מבקשת' })} להצטרף
                לטיול
              </p>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Button loading={busy === request.uid} onClick={() => void decide(request, true)}>
                אישור
              </Button>
              <Button variant="secondary" disabled={busy === request.uid} onClick={() => void decide(request, false)}>
                דחייה
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
