import { useState } from 'react'
import { TriangleAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import type { Trip } from '@/data/types'
import { deleteTripWithProgress } from '@/store/deletion'

const CONFIRM_WORD = 'מחיקה'

/**
 * The owner deletes the trip for everyone. A warning that it can't be undone, and the word "מחיקה"
 * typed in, so it never happens by a slip of the finger.
 */
export function DeleteTrip({ trip, onDeleted }: { trip: Trip; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const confirmed = typed.trim() === CONFIRM_WORD

  // The deletion runs behind a full-screen "deleting…" screen, above the profile sheet that started it.
  const remove = () => {
    if (!confirmed) return
    onDeleted()
    void deleteTripWithProgress(trip)
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-control py-2.5 text-sm font-medium text-red-600 hover:bg-red-500/8 dark:text-red-400"
      >
        <Trash2 aria-hidden className="size-4" />
        מחיקת הטיול
      </button>
    )

  return (
    <div role="alertdialog" aria-label="מחיקת הטיול" className="mt-3 rounded-card border border-red-500/40 bg-red-500/[0.07] p-4">
      <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
        <TriangleAlert aria-hidden className="size-5 shrink-0" />
        למחוק את הטיול לצמיתות?
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        כל מה שבטיול{' '}
        <b>
          ״<bdi>{trip.name}</bdi>״
        </b>{' '}
        יימחק לכל השותפים: המקומות, הלו״ז, הצ׳אט והכרטיסים. <b>אי אפשר לשחזר את זה.</b>
      </p>
      <div className="mt-3">
        <TextField
          label={`כדי לאשר, הקלידו "${CONFIRM_WORD}"`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          dir="rtl"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" className="flex-1" disabled={!confirmed} onClick={remove}>
          מחיקה לצמיתות
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false)
            setTyped('')
          }}
        >
          ביטול
        </Button>
      </div>
    </div>
  )
}
