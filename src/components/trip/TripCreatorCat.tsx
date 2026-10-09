import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

/** Frames of the trip-creator clip (public/mascot/creator/NNN.webp), 12 a second. */
const FPS = 12
const FRAMES = 120
/** Thinking and drawing on the map: played in a loop while the AI works. */
const WORK_END = 76
/** Cheering, then off with the backpack: played once when the trip is ready, ending on the last frame. */
const DONE_START = 78
/** Frames blended at the loop's seam, so the jump back to the start doesn't show. */
const BLEND = 4

/** How long the "ready" part plays (the wizard waits for it before showing the plan). */
export const CREATOR_DONE_MS = Math.round(((FRAMES - DONE_START) / FPS) * 1000) + 300

const frameUrl = (n: number) => `${import.meta.env.BASE_URL}mascot/creator/${String(n).padStart(3, '0')}.webp`

let loaded: HTMLImageElement[] | null = null

/** Starts loading every frame (once per session). */
export function preloadCreatorFrames(): HTMLImageElement[] {
  loaded ??= Array.from({ length: FRAMES }, (_, n) => {
    const image = new Image()
    image.decoding = 'async'
    image.src = frameUrl(n)
    return image
  })
  return loaded
}

export type CreatorStage = 'working' | 'done'

/**
 * The trip-creator cat, an animated clip played as an image sequence (iPhones can't play video with
 * a transparent background): it thinks and draws on its map while the AI works, and cheers and sets
 * off with a backpack when the trip is ready.
 */
export function TripCreatorCat({ stage }: { stage: CreatorStage }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const images = preloadCreatorFrames()
    const ready = (n: number) => images[n]!.complete && images[n]!.naturalWidth > 0
    let frame = stage === 'done' ? DONE_START : 0
    let shown = -1
    let last = 0
    let raf = 0

    const draw = (n: number, blendWith?: number, amount = 0) => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.globalAlpha = 1
      context.drawImage(images[n]!, 0, 0, canvas.width, canvas.height)
      if (blendWith != null && amount > 0 && ready(blendWith)) {
        context.globalAlpha = amount
        context.drawImage(images[blendWith]!, 0, 0, canvas.width, canvas.height)
        context.globalAlpha = 1
      }
      shown = n
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (reduceMotion) {
        const still = stage === 'done' ? FRAMES - 1 : 0
        if (shown !== still && ready(still)) draw(still)
        return
      }
      if (now - last < 1000 / FPS) return
      // Wait for a frame that hasn't arrived yet rather than skip it.
      if (!ready(frame)) return
      last = now
      if (stage === 'working') {
        // The last frames of the loop fade into the first ones.
        const intoLoop = frame - (WORK_END - BLEND)
        draw(frame, intoLoop >= 0 ? intoLoop : undefined, intoLoop >= 0 ? (intoLoop + 1) / (BLEND + 1) : 0)
        frame = frame >= WORK_END ? BLEND : frame + 1
      } else {
        draw(frame)
        frame = Math.min(frame + 1, FRAMES - 1)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stage, reduceMotion])

  return <canvas ref={canvasRef} width={360} height={360} aria-hidden className="mx-auto size-72" />
}
