import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useReducedMotion } from 'motion/react'

/** An animated clip as an image sequence (public/mascot/oni/<id>/NNN.webp): iPhones can't play video with a transparent background. */
export interface FrameClip {
  id: string
  frames: number
  fps: number
  /** Pixel size of the (square) frames. */
  size: number
}

/** Oni's clips. Each is a seamless loop: the last frame flows into the first. */
export const ONI_CLIPS = {
  /** Waves hello (sign-up). */
  hello: { id: 'hello', frames: 120, fps: 12, size: 320 },
  /** Sweeps up (deleting a trip). */
  sweep: { id: 'delete', frames: 120, fps: 12, size: 320 },
  /** Reads the map, has an idea, jumps for joy (planning the whole trip). */
  plan: { id: 'plan', frames: 120, fps: 12, size: 360 },
} satisfies Record<string, FrameClip>

/** Bumped when the artwork is redrawn: the service worker keeps frames by URL, so new ones get a new URL. */
const ART_VERSION = 2

/** Oni's still poses, in public/mascot/oni/. */
export const oniStill = (pose: 'guide' | 'map' | 'cover' | 'peek') => `${import.meta.env.BASE_URL}mascot/oni/${pose}.webp?v=${ART_VERSION}`

const loaded = new Map<string, HTMLImageElement[]>()

/** Starts loading every frame of a clip (once per session). */
export function preloadClip(clip: FrameClip): HTMLImageElement[] {
  let images = loaded.get(clip.id)
  if (!images) {
    images = Array.from({ length: clip.frames }, (_, n) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = `${import.meta.env.BASE_URL}mascot/oni/${clip.id}/${String(n).padStart(3, '0')}.webp?v=${ART_VERSION}`
      return image
    })
    loaded.set(clip.id, images)
  }
  return images
}

/**
 * Plays a clip on a loop, start to end and around again. A frame that hasn't arrived yet is waited
 * for rather than skipped, so a slow connection slows the clip down instead of making it stutter.
 * With "reduce motion" it shows the first frame only.
 */
export function FrameLoop({ clip, className }: { clip: FrameClip; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const drawSize = Math.round(clip.size * dpr)
    canvas.width = drawSize
    canvas.height = drawSize
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const images = preloadClip(clip)
    const ready = (n: number) => images[n]!.complete && images[n]!.naturalWidth > 0
    let frame = 0
    let last = 0
    let raf = 0

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 1000 / clip.fps || !ready(frame)) return
      last = now
      context.clearRect(0, 0, drawSize, drawSize)
      context.drawImage(images[frame]!, 0, 0, drawSize, drawSize)
      if (reduceMotion) return
      frame = (frame + 1) % clip.frames
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clip, reduceMotion])

  return <canvas ref={canvasRef} aria-hidden className={clsx('select-none', className)} />
}
