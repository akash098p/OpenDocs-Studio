import JSZip from 'jszip'
import { ToolFile, ToolOutput, ToolParams } from './types'

export const fileExtension = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return ext === name ? '' : ext
}

export const fileName = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export const sanitizeFilename = (value: string): string => {
  return (
    String(value || '')
      // eslint-disable-next-line no-control-regex -- control characters are illegal in filenames and must be stripped
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+|\.+$/g, '')
      .replace(/\.+/g, '.')
      .replace(/^_+|_+$/g, '') || 'output'
  )
}

export const getFile = (files: ToolFile[], name: string): ToolFile => {
  const match = files.find((file) => file.name === name)
  if (!match) throw new Error(`Missing required input: "${name}"`)
  return match
}

export const getFiles = (files: ToolFile[], name: string): ToolFile[] =>
  files.filter((file) => file.name === name)

export const numberParam = (params: ToolParams, name: string, fallback = 0): number => {
  const value = Number(params[name])
  return Number.isFinite(value) ? value : fallback
}

export const stringParam = (params: ToolParams, name: string, fallback = ''): string =>
  params[name] ?? fallback

const mimeMap: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  zip: 'application/zip',
}

export const mimeFor = (ext: string): string => mimeMap[ext.toLowerCase()] || 'application/octet-stream'

export const loadImage = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode the image file.'))
    }
    image.src = url
  })

export const canvasToBlob = (canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    if (mime === 'image/bmp') {
      resolve(blobFromCanvasBmp(canvas))
      return
    }
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode the image.'))
      },
      mime,
      quality,
    )
  })

// Minimal BMP encoder so Image Format Converter can offer BMP output.
function blobFromCanvasBmp(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read canvas data.')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const pixelDataSize = rowSize * height
  const headerSize = 54
  const buffer = new ArrayBuffer(headerSize + pixelDataSize)
  const view = new DataView(buffer)
  let offset = 0
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i))
    offset += s.length
  }
  writeString('BM')
  view.setUint32(offset, buffer.byteLength, true)
  offset += 4
  view.setUint32(offset, 0, true)
  offset += 4
  view.setUint32(offset, headerSize, true)
  offset += 4
  view.setUint32(offset, 40, true)
  offset += 4
  view.setInt32(offset, width, true)
  offset += 4
  view.setInt32(offset, height, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, 24, true)
  offset += 2
  view.setUint32(offset, 0, true)
  offset += 4
  view.setUint32(offset, pixelDataSize, true)
  offset += 4
  view.setInt32(offset, 2835, true)
  offset += 4
  view.setInt32(offset, 2835, true)
  offset += 4
  view.setUint32(offset, 0, true)
  offset += 4
  view.setUint32(offset, 0, true)
  offset += 4
  const bytes = new Uint8Array(buffer)
  const pixels = imageData.data
  for (let y = 0; y < height; y += 1) {
    const rowOffset = headerSize + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4
      const dest = rowOffset + x * 3
      bytes[dest] = pixels[pixel + 2] // B
      bytes[dest + 1] = pixels[pixel + 1] // G
      bytes[dest + 2] = pixels[pixel] // R
    }
  }
  return new Blob([buffer], { type: 'image/bmp' })
}

export const makeZip = async (outputs: Array<{ name: string; blob: Blob }>): Promise<Blob> => {
  const zip = new JSZip()
  for (const output of outputs) zip.file(output.name, output.blob)
  return zip.generateAsync({ type: 'blob' }) as Promise<Blob>
}

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export const singleOutput = (outputs: ToolOutput[]): ToolOutput => {
  if (outputs.length !== 1) throw new Error('Expected a single output file.')
  return outputs[0]
}