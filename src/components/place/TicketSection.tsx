import { useRef, useState } from 'react'
import { ChevronLeft, LoaderCircle, QrCode, Upload } from 'lucide-react'
import { addTickets } from '@/data/tickets'
import type { Place, Ticket } from '@/data/types'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/**
 * Entry tickets for a place (museum, theme park, show…): add the QR / barcode ahead as a photo,
 * screenshot or PDF, then open it full screen at the gate, also without signal.
 */
export function TicketSection({ place }: { place: Place }) {
  const tickets = useTripStore((state) => state.tickets).filter((ticket) => ticket.placeId === place.id)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFiles = async (files: File[]) => {
    if (files.length === 0) return
    setBusy(true)
    try {
      const added = await addTickets(place.id, files)
      ui.toast(added > 1 ? `נשמרו ${added} כרטיסים` : 'הכרטיס נשמר. אפשר לפתוח אותו גם בלי אינטרנט')
    } catch (error) {
      console.warn('[tickets] could not read the file', error)
      ui.toast('לא הצלחנו לקרוא את הקובץ. נסו תמונה (צילום מסך) או PDF', 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="mt-4">
      {tickets.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
            <QrCode aria-hidden className="size-3.5" />
            כרטיסי כניסה
          </p>
          <ul className="mb-2 space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketRow ticket={ticket} />
              </li>
            ))}
          </ul>
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(event) => void onFiles([...(event.target.files ?? [])])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex w-full items-center gap-2 rounded-control border border-dashed border-line px-4 py-3 text-sm text-muted transition hover:bg-fg/[0.03] disabled:opacity-70"
      >
        {busy ? (
          <LoaderCircle aria-hidden className="size-4.5 shrink-0 animate-spin" />
        ) : (
          <Upload aria-hidden className="size-4.5 shrink-0" />
        )}
        {busy ? 'מכינים את הכרטיס…' : tickets.length ? 'הוספת כרטיס נוסף' : 'יש כרטיס כניסה? העלו אותו לכאן (תמונה או PDF)'}
      </button>
    </div>
  )
}

export function TicketRow({ ticket, showPlace }: { ticket: Ticket; showPlace?: string }) {
  return (
    <button
      type="button"
      onClick={() => ui.openTicket(ticket)}
      className="flex w-full items-center gap-3 rounded-control bg-accent/10 px-3.5 py-3 text-start transition active:scale-[0.98]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-inner bg-accent-fill text-accent-fg">
        <QrCode aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold" dir="auto">
          {showPlace ?? ticket.name}
        </span>
        <span className="block truncate text-xs text-muted" dir="auto">
          {showPlace
            ? ticket.name
            : `${ticket.pages > 1 ? `${ticket.pages} עמודים · ` : ''}${ticket.addedBy ? `הועלה ע״י ${ticket.addedBy}` : ''}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center text-xs font-semibold text-accent">
        פתיחה
        <ChevronLeft aria-hidden className="size-4" />
      </span>
    </button>
  )
}
