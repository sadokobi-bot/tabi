import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useLatest } from '@/hooks/useLatest'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name of the dialog. */
  label: string
  children: ReactNode
}

/**
 * Glass bottom sheet: springs up from the bottom, drag the handle down (or tap the scrim / Esc) to close.
 * Only the handle starts a drag, so the content can scroll freely.
 */
export function BottomSheet({ open, onClose, label, children }: BottomSheetProps) {
  const dragControls = useDragControls()
  const sheetRef = useRef<HTMLElement>(null)

  const onCloseRef = useLatest(onClose)

  // Only on opening: re-running on every render (e.g. a new inline onClose) would pull focus out of
  // a text field inside the sheet after each keystroke and close the phone keyboard.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    sheetRef.current?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCloseRef])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            aria-hidden
            className="fixed inset-0 z-50 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-sheet outline-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42, mass: 0.9 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-2 active:cursor-grabbing"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <span className="h-1.5 w-11 rounded-full bg-fg/20" />
            </div>
            <div className="pb-sheet min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
