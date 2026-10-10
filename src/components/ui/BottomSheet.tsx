import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useLatest } from '@/hooks/useLatest'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  // Like a modal dialog: Tab stays inside the sheet, and closing returns focus to what opened it.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      const sheet = sheetRef.current
      if (event.key !== 'Tab' || !sheet) return
      const focusables = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement
      if (!sheet.contains(active) || (event.shiftKey ? active === first || active === sheet : active === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    sheetRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const active = document.activeElement
      if (opener?.isConnected && (active === document.body || sheetRef.current?.contains(active))) opener.focus({ preventScroll: true })
    }
  }, [open, onCloseRef])

  // On the page itself: a sheet opened inside a tab's screen would otherwise sit under the tab bar.
  return createPortal(
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
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-sheet lg:max-w-xl outline-none"
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
    </AnimatePresence>,
    document.body,
  )
}
