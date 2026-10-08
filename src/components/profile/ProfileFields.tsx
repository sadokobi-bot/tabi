import clsx from 'clsx'
import { UserRound } from 'lucide-react'
import { TextField } from '@/components/ui/TextField'
import type { Gender } from '@/data/types'

export interface ProfileDraft {
  firstName: string
  lastName: string
  gender: Gender | null
}

export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'אישה' },
  { value: 'male', label: 'גבר' },
  { value: 'other', label: 'אחר' },
]

/** Hebrew error per missing field, or an empty object when the draft is complete. */
export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!draft.firstName.trim()) errors.firstName = 'הקלידו שם פרטי'
  if (!draft.lastName.trim()) errors.lastName = 'הקלידו שם משפחה'
  if (!draft.gender) errors.gender = 'בחרו אחת מהאפשרויות'
  return errors
}

/** First name, last name and gender (used for Hebrew grammar). Shared by sign-up and profile completion. */
export function ProfileFields({
  draft,
  errors,
  onChange,
}: {
  draft: ProfileDraft
  errors: ProfileErrors
  onChange: (patch: Partial<ProfileDraft>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="שם פרטי"
          leading={<UserRound className="size-[18px]" />}
          value={draft.firstName}
          onChange={(event) => onChange({ firstName: event.target.value })}
          error={errors.firstName}
          autoComplete="given-name"
          maxLength={30}
        />
        <TextField
          label="שם משפחה"
          value={draft.lastName}
          onChange={(event) => onChange({ lastName: event.target.value })}
          error={errors.lastName}
          autoComplete="family-name"
          maxLength={30}
        />
      </div>
      <div>
        <p id="gender-label" className="mb-1.5 text-sm font-medium">
          מגדר
        </p>
        <div role="radiogroup" aria-labelledby="gender-label" className="grid grid-cols-3 gap-1 rounded-control bg-fg/6 p-1">
          {GENDERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.gender === value}
              onClick={() => onChange({ gender: value })}
              className={clsx(
                'h-10 rounded-inner text-sm font-semibold transition',
                draft.gender === value ? 'bg-accent-fill text-accent-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {errors.gender ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            {errors.gender}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted">כדי שנפנה אליכם נכון בעברית</p>
        )}
      </div>
    </div>
  )
}
