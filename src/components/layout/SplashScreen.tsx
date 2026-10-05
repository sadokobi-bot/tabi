import { motion } from 'motion/react'
import { BrandMark } from '@/components/brand/BrandMark'

/** Full-screen launch state while the session / trip data load. */
export function SplashScreen({ message }: { message?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <div className="flex flex-col items-center">
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <BrandMark className="size-20" />
        </motion.div>
        <p role="status" className="mt-5 max-w-xs text-sm text-muted">
          {message ?? 'טוענים את הטיול…'}
        </p>
      </div>
    </div>
  )
}
