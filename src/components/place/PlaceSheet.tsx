import { useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { usePlace } from '@/store/trip'
import { ui, useUi, type Selection } from '@/store/ui'
import { PlaceForm } from './PlaceForm'
import { PlaceView, type PlaceSubject } from './PlaceView'
import { ScheduleForm } from './ScheduleForm'

function selectionKey(selection: Selection): string {
  if (selection.kind === 'place') return `place:${selection.placeId}`
  if (selection.kind === 'poi') return `poi:${selection.poi.key}`
  return `draft:${selection.draft.location.lat},${selection.draft.location.lng}`
}

/** Global place-details sheet: opened from map markers, search, the Today timeline and the trip board. */
export function PlaceSheet() {
  const selection = useUi((state) => state.selection)

  return (
    <BottomSheet open={selection !== null} onClose={ui.closeSheet} label="פרטי מקום">
      {selection && <PlaceSheetBody key={selectionKey(selection)} selection={selection} />}
    </BottomSheet>
  )
}

type Mode = { name: 'view' } | { name: 'edit' } | { name: 'schedule'; placeId: string }

function PlaceSheetBody({ selection }: { selection: Selection }) {
  const [mode, setMode] = useState<Mode>(selection.kind === 'draft' ? { name: 'edit' } : { name: 'view' })
  const saved = usePlace(selection.kind === 'place' ? selection.placeId : null)

  if (mode.name === 'schedule') {
    return <ScheduleForm placeId={mode.placeId} onDone={() => ui.openPlace(mode.placeId)} />
  }

  if (selection.kind === 'draft') {
    return <PlaceForm initial={selection.draft} onCancel={ui.closeSheet} onSaved={(id) => ui.openPlace(id)} />
  }

  if (selection.kind === 'place' && !saved) {
    return <p className="px-6 py-10 text-center text-sm text-muted">המקום הזה כבר לא קיים בטיול.</p>
  }

  if (mode.name === 'edit' && saved) {
    return <PlaceForm initial={saved} existing={saved} onCancel={() => setMode({ name: 'view' })} onSaved={() => setMode({ name: 'view' })} />
  }

  const subject: PlaceSubject =
    selection.kind === 'place' && saved
      ? { ...saved, saved }
      : selection.kind === 'poi'
        ? { ...selection.poi, poi: selection.poi }
        : { name: '', category: 'other', location: { lat: 0, lng: 0 } }

  return (
    <PlaceView
      subject={subject}
      onEdit={() => setMode({ name: 'edit' })}
      onSchedule={(placeId) => setMode({ name: 'schedule', placeId })}
    />
  )
}
