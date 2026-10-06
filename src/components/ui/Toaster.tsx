import { useEffect } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useUi } from '@/store/ui'

/** Single floating toast above the tab bar; auto-dismisses. */
export function Toaster() {
  const toast = useUi((state) => state.toast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      if (useUi.getState().toast?.id === toast.id) useUi.setState({ toast: null })
    }, toast.tone === 'error' ? 5000 : 2600)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div aria-live="polite" className="bottom-above-tabbar pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className={clsx(
              'glass max-w-sm rounded-control px-4 py-3 text-sm font-medium',
              toast.tone === 'error' && 'text-red-600 dark:text-red-400',
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
