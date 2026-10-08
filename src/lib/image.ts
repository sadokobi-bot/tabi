import type { PromptImage } from './assistant'

/** Shrinks a photo or screenshot to a size Gemini reads well (and the free tier handles quickly). */
export async function prepareImage(file: File, maxSide = 2000): Promise<PromptImage & { preview: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const preview = canvas.toDataURL('image/jpeg', 0.85)
  return { data: preview.slice(preview.indexOf(',') + 1), mimeType: 'image/jpeg', preview }
}
