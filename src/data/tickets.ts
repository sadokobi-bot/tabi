import { displayName, errorMessage } from '@/backend'
import { newId } from '@/lib/ids'
import { cachedPages, cachedTicketIds, cachePages, dropPages } from '@/lib/ticketCache'
import { ticketNameFrom, ticketPagesFrom } from '@/lib/ticketFiles'
import { getBackend, useSession } from '@/store/session'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'
import type { Ticket } from './types'

function activeTripId(): string {
  const id = useTripStore.getState().activeTripId
  if (!id) throw new Error('No active trip')
  return id
}

/**
 * Turns the chosen files (photos, screenshots, PDFs) into tickets for a place. The pages are kept
 * on this device first, so the ticket opens right away and offline; syncing to the trip runs behind.
 */
export async function addTickets(placeId: string, files: File[]): Promise<number> {
  const user = useSession.getState().user
  const tripId = activeTripId()
  let added = 0
  for (const file of files) {
    const pages = await ticketPagesFrom(file)
    if (pages.length === 0) continue
    const ticket: Ticket = {
      id: newId(),
      placeId,
      name: ticketNameFrom(file),
      pages: pages.length,
      addedBy: user ? displayName(user).slice(0, 60) : '',
      at: Date.now(),
    }
    await cachePages(ticket.id, pages)
    getBackend()
      .addTicket(tripId, ticket, pages)
      .catch((error: unknown) => ui.toast(`הכרטיס "${ticket.name}" לא נשמר: ${errorMessage(error)}`, 'error'))
    added++
  }
  return added
}

/** The pages: from this device when they're here, else from the trip (and kept for next time). */
export async function loadTicketPages(ticket: Ticket): Promise<string[]> {
  const cached = await cachedPages(ticket.id)
  if (cached?.length) return cached
  const pages = await getBackend().ticketPages(activeTripId(), ticket)
  if (pages.length && pages.every(Boolean)) await cachePages(ticket.id, pages).catch(() => undefined)
  return pages
}

export function deleteTicket(ticket: Ticket) {
  getBackend()
    .deleteTicket(activeTripId(), ticket)
    .then(
      () => ui.toast('הכרטיס נמחק'),
      (error: unknown) => ui.toast(errorMessage(error), 'error'),
    )
  void dropPages(ticket.id)
}

/**
 * Brings every ticket of the trip onto this device, one at a time, so they all open without signal
 * (also the ones another member added). Each is downloaded once per device.
 */
export async function prefetchTickets(tickets: Ticket[], signal: { cancelled: boolean }) {
  const have = await cachedTicketIds()
  for (const ticket of tickets) {
    if (signal.cancelled || !navigator.onLine) return
    if (have.has(ticket.id)) continue
    try {
      await loadTicketPages(ticket)
    } catch (error) {
      console.warn('[tickets] could not keep a ticket offline', error)
    }
  }
}
