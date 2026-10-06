import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { actions, type PlaceFields } from '@/data/actions'
import { CATEGORY_LIST } from '@/data/categories'
import type { Place } from '@/data/types'
import { safeHttpUrl } from '@/lib/deeplinks'

interface PlaceFormProps {
  initial: PlaceFields
  /** Present when editing an existing place. */
  existing?: Place
  onCancel: () => void
  onSaved: (placeId: string) => void
}

/** Create / edit one of "our" places: name, category, notes and an optional link. */
export function PlaceForm({ initial, existing, onCancel, onSaved }: PlaceFormProps) {
  const [name, setName] = useState(initial.name)
  const [category, setCategory] = useState(initial.category)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [url, setUrl] = useState(initial.url ?? '')
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedUrl = url.trim()
    const nextErrors = {
      name: name.trim() ? undefined : 'תנו למקום שם',
      url: trimmedUrl && !safeHttpUrl(trimmedUrl) ? 'קישור לא תקין (צריך להתחיל ב-https://)' : undefined,
    }
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.url) return

    const fields: PlaceFields = {
      ...initial,
      name: name.trim(),
      category,
      notes: notes.trim() || undefined,
      url: trimmedUrl || undefined,
    }
    if (existing) {
      actions.updatePlace(existing, fields, 'השינויים נשמרו')
      onSaved(existing.id)
    } else {
      onSaved(actions.createPlace(fields).id)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-5 pt-2 pb-4" noValidate>
      <h2 className="text-xl font-bold">{existing ? 'עריכת מקום' : 'מקום חדש'}</h2>

      <TextField
        label="שם המקום"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
        maxLength={80}
        autoFocus={!existing}
        placeholder="למשל: הראמן שהמלון המליץ עליו"
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">קטגוריה</legend>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORY_LIST.map((option) => {
            const Icon = option.icon
            const active = option.id === category
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(option.id)}
                className={clsx(
                  'flex items-center gap-2 rounded-control border px-3 py-2.5 text-sm font-medium transition active:scale-95',
                  active ? 'border-transparent text-white' : 'border-line bg-card/60 hover:bg-fg/5',
                )}
                style={active ? { background: option.color } : undefined}
              >
                <Icon aria-hidden className="size-4 shrink-0" style={active ? undefined : { color: option.color }} />
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <TextAreaField
        label="הערות"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={1000}
        placeholder="שעות מומלצות, מה להזמין, כרטיסים…"
      />

      <TextField
        label="קישור (לא חובה)"
        type="url"
        inputMode="url"
        dir="ltr"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        error={errors.url}
        placeholder="https://"
      />

      <p className="flex items-center gap-1.5 text-xs text-muted" dir="ltr">
        <MapPin aria-hidden className="size-3.5" />
        {initial.location.lat.toFixed(5)}, {initial.location.lng.toFixed(5)}
      </p>

      <div className="flex gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1">
          {existing ? 'שמירת שינויים' : 'הוספה לטיול'}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </form>
  )
}
