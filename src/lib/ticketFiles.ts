import { TICKET_MAX_PAGES, TICKET_PAGE_MAX_CHARS } from '@/backend/types'

/** Wide enough that a QR code or barcode stays sharp for a scanner, small enough to sync quickly. */
const PAGE_WIDTH = 1400
const IMAGE_MAX_SIDE = 2200

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** The file's name without its extension, as a starting name for the ticket. */
export function ticketNameFrom(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'כרטיס'
}

/** JPEG on white (PDFs and screenshots may be transparent), shrunk until it fits one stored page. */
function encode(source: CanvasImageSource, width: number, height: number): string {
  let scale = 1
  for (;;) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const g = canvas.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(source, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.9, 0.8, 0.7]) {
      const url = canvas.toDataURL('image/jpeg', quality)
      const data = url.slice(url.indexOf(',') + 1)
      if (data.length <= TICKET_PAGE_MAX_CHARS) return data
    }
    scale *= 0.8
  }
}

async function imagePages(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  try {
    return [encode(bitmap, bitmap.width * scale, bitmap.height * scale)]
  } finally {
    bitmap.close()
  }
}

async function pdfPages(file: File): Promise<string[]> {
  // pdf.js is only downloaded when a PDF ticket is added.
  const [pdfjs, { default: workerUrl }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    const pages: string[] = []
    for (let number = 1; number <= Math.min(doc.numPages, TICKET_MAX_PAGES); number++) {
      const page = await doc.getPage(number)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(4, PAGE_WIDTH / base.width) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')!
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: context, viewport }).promise
      pages.push(encode(canvas, canvas.width, canvas.height))
      page.cleanup()
    }
    return pages
  } finally {
    void doc.destroy()
  }
}

/** A photo, screenshot or PDF ticket as page images (JPEG base64). */
export function ticketPagesFrom(file: File): Promise<string[]> {
  return isPdf(file) ? pdfPages(file) : imagePages(file)
}
