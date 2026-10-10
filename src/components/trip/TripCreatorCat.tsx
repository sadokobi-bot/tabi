import { FrameLoop, ONI_CLIPS, preloadClip } from '@/components/brand/FrameLoop'

/** How long the "ready" moment stays before the plan shows. */
export const CREATOR_DONE_MS = 1200

/** Starts loading the planning clip (once per session). */
export const preloadCreatorFrames = () => preloadClip(ONI_CLIPS.plan)

/** Oni planning the trip: reads the map, has an idea, jumps for joy, on a loop while the AI works. */
export function TripCreatorCat() {
  return <FrameLoop clip={ONI_CLIPS.plan} className="mx-auto size-72" />
}
