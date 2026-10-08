/**
 * The ticket pages kept on this device (IndexedDB), so a ticket opens at the gate with no signal.
 * Pages are JPEG images as base64. In local mode this is where tickets live.
 */

const DB_NAME = 'tabi-tickets'
const STORE = 'pages'

let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  opening.catch(() => (opening = null))
  return opening
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  })
}

export async function cachedPages(ticketId: string): Promise<string[] | null> {
  try {
    return (await run<string[] | undefined>('readonly', (store) => store.get(ticketId))) ?? null
  } catch {
    return null
  }
}

export async function cachePages(ticketId: string, pages: string[]): Promise<void> {
  await run('readwrite', (store) => store.put(pages, ticketId))
}

export async function dropPages(ticketId: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(ticketId))
  } catch {
    // Nothing cached, or storage unavailable: nothing to remove.
  }
}

export async function cachedTicketIds(): Promise<Set<string>> {
  try {
    return new Set((await run<IDBValidKey[]>('readonly', (store) => store.getAllKeys())).map(String))
  } catch {
    return new Set()
  }
}
