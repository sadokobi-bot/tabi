/**
 * The saved place the group sleeps at on the night of `date`: the latest check-in on or before it
 * (see Trip.stays). Null when no stay applies, including after a stay was ended with ''.
 */
export function stayFor(stays: Record<string, string>, date: string): string | null {
  let found = ''
  let foundDate = ''
  for (const [checkIn, placeId] of Object.entries(stays)) {
    if (checkIn <= date && checkIn > foundDate) {
      foundDate = checkIn
      found = placeId
    }
  }
  return found || null
}
