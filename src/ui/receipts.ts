const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.72
const MAX_DATA_URL_LENGTH = 1_400_000

export async function compressReceipt(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('La imagen no puede superar 12 MB.')

  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo procesar la imagen.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    let result = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    if (result.length > MAX_DATA_URL_LENGTH) {
      const width = Math.max(1, Math.round(canvas.width * 0.7))
      const height = Math.max(1, Math.round(canvas.height * 0.7))
      const smaller = document.createElement('canvas')
      smaller.width = width
      smaller.height = height
      const smallerContext = smaller.getContext('2d')
      if (!smallerContext) throw new Error('No se pudo procesar la imagen.')
      smallerContext.drawImage(canvas, 0, 0, width, height)
      result = smaller.toDataURL('image/jpeg', 0.64)
    }
    if (result.length > MAX_DATA_URL_LENGTH) {
      throw new Error('La imagen sigue siendo demasiado grande; intenta recortarla.')
    }
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    image.src = url
  })
}
