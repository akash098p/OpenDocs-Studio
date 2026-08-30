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
  avif: 'image/avif',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  zip: 'application/zip',
  svg: 'image/svg+xml',
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

export const canvasToBlob = async (canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> => {
  if (mime === 'image/bmp') return blobFromCanvasBmp(canvas)
  if (mime === 'image/gif') return canvasToGif(canvas)
  if (mime === 'image/x-icon') return canvasToIco(canvas)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode the image.'))
      },
      mime,
      quality,
    )
  })
}

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

// GIF encoder backed by gifenc: quantizes the RGBA pixels to a 256-color
// palette, maps every pixel to the nearest palette index and writes a single
// frame. This lets the Image Format Converter offer GIF output everywhere.
async function canvasToGif(canvas: HTMLCanvasElement): Promise<Blob> {
  const gifenc = await import('gifenc')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read canvas data.')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const palette = gifenc.quantize(imageData.data, 256)
  const index = gifenc.applyPalette(imageData.data, palette)
  const gif = gifenc.GIFEncoder()
  gif.writeFrame(index, width, height, { palette })
  gif.finish()
  // Wrap in a fresh Uint8Array so the result is backed by an ArrayBuffer
  // (gifenc's internal buffer is larger / offset, and TS requires ArrayBuffer).
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' })
}

// ICO wrapper: embeds a PNG of the canvas inside a .ico container. The ICO
// spec caps single entries at 256×256, so larger canvases are downscaled
// (aspect-ratio preserved) before embedding.
async function canvasToIco(canvas: HTMLCanvasElement): Promise<Blob> {
  const max = 256
  let icon = canvas
  if (canvas.width > max || canvas.height > max) {
    const scale = Math.min(max / canvas.width, max / canvas.height)
    const width = Math.max(1, Math.round(canvas.width * scale))
    const height = Math.max(1, Math.round(canvas.height * scale))
    icon = document.createElement('canvas')
    icon.width = width
    icon.height = height
    const ctx = icon.getContext('2d')
    if (!ctx) throw new Error('Could not scale canvas data.')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, width, height)
  }

  const png = await new Promise<Blob>((resolve, reject) => {
    icon.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not encode the image.'))
    }, 'image/png')
  })
  const pngBytes = new Uint8Array(await png.arrayBuffer())
  const sizeByte = (n: number): number => (n >= max ? 0 : n)

  const headerSize = 6 + 16
  const buffer = new ArrayBuffer(headerSize + pngBytes.byteLength)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // ICONDIR
  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, 1, true) // image count
  // ICONDIRENTRY
  bytes[6] = sizeByte(icon.width) // icon width (0 = 256)
  bytes[7] = sizeByte(icon.height) // icon height (0 = 256)
  bytes[8] = 0 // colors (0 = default)
  bytes[9] = 0 // reserved
  view.setUint16(10, 1, true) // planes
  view.setUint16(12, 32, true) // bit depth (32-bit RGBA)
  view.setUint32(14, pngBytes.byteLength, true) // size of embedded image data
  view.setUint32(18, headerSize, true) // offset to embedded image data
  bytes.set(pngBytes, headerSize)

  return new Blob([buffer], { type: 'image/x-icon' })
}

// ---------------------------------------------------------------------------
// Lossy PNG compression (indexed PNG + color quantization)
// ---------------------------------------------------------------------------

// CRC-32 as required by the PNG spec (reflected polynomial 0xEDB88320).
function pngCrc32(input: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input[i]
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(typeBytes, 4)
  out.set(data, 8)
  const crcInput = new Uint8Array(typeBytes.length + data.length)
  crcInput.set(typeBytes, 0)
  crcInput.set(data, typeBytes.length)
  view.setUint32(8 + data.length, pngCrc32(crcInput))
  return out
}

// CompressionStream('deflate') emits the ZLIB-wrapped stream PNG IDAT needs.
// The readable side must be consumed WHILE writing: writer.write() blocks on
// backpressure once the stream queue fills, and awaiting write+close before
// reading deadlocks on larger images. We pump chunks out as they arrive.
const zlibDeflate = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new CompressionStream('deflate')
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()

  const chunks: Uint8Array[] = []
  let total = 0
  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.byteLength
    }
  })()

  // Re-wrap so the input is an ArrayBuffer-backed Uint8Array (required here).
  await writer.write(new Uint8Array(data))
  await writer.close()
  await pump

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

interface IndexedPngParts {
  width: number
  height: number
  /** [r,g,b] triplets in 0..255 */
  palette: number[][]
  /** One palette index per pixel */
  index: Uint8Array
  /** Per-palette-entry alpha in 0..255 */
  alpha: Uint8Array
}

async function buildIndexedPng(parts: IndexedPngParts): Promise<Uint8Array> {
  const { width, height, palette, index, alpha } = parts

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // color type: indexed
  // 10..12: compression / filter / interlace = 0

  const plte = new Uint8Array(palette.length * 3)
  for (let i = 0; i < palette.length; i += 1) {
    plte[i * 3] = palette[i][0]
    plte[i * 3 + 1] = palette[i][1]
    plte[i * 3 + 2] = palette[i][2]
  }

  // Raw scanlines: 1 "filter None" byte + one index byte per pixel.
  const raw = new Uint8Array((1 + width) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width)] = 0
    raw.set(index.subarray(y * width, (y + 1) * width), y * (1 + width) + 1)
  }
  const idat = await zlibDeflate(raw)

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const chunks: Uint8Array[] = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
  ]
  // tRNS is only needed when some palette entry is semi/fully transparent.
  if (alpha.some((a) => a < 255)) chunks.push(pngChunk('tRNS', alpha))
  chunks.push(pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0)))

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * Encode a canvas as a compressed indexed PNG by reducing it to at most
 * `colors` palette entries (TinyPNG-style). The indexed output is typically
 * far smaller than a plain 8-bit RGBA re-encode, which is what lets the Image
 * Compressor actually shrink files when the output format is PNG or "auto".
 *
 * Performance guards for large photos:
 * - the palette is derived from a color-rich sample (max ~200k pixels) instead
 *   of the full image, and
 * - very large images automatically use fewer palette colors so palette-mapping
 *   stays quick.
 *
 * Falls back to a plain lossless PNG encode where CompressionStream is
 * unavailable or any step fails.
 */
export const canvasToCompressedPng = async (canvas: HTMLCanvasElement, colors = 256): Promise<Blob> => {
  const maxColorsRequested = Math.max(2, Math.min(256, Math.round(colors)))
  if (typeof CompressionStream === 'undefined') {
    return canvasToBlob(canvas, 'image/png')
  }
  const gifenc = await import('gifenc')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read canvas data.')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const totalPixels = width * height

  try {
    // Adaptive color cap: keep palette-mapping cheap on very large photos.
    const maxColors =
      totalPixels > 4_000_000
        ? Math.max(64, Math.round(maxColorsRequested * (4_000_000 / totalPixels)))
        : maxColorsRequested

    // Sample the image to build the palette (covers the color space, keeps the
    // PNN quantizer fast no matter how large the source is).
    const sampleSize = Math.min(totalPixels, 200_000)
    const sample = new Uint8ClampedArray(sampleSize * 4)
    if (sampleSize === totalPixels) {
      sample.set(data)
    } else {
      const step = totalPixels / sampleSize
      for (let i = 0; i < sampleSize; i += 1) {
        const src = Math.min(totalPixels - 1, Math.round(i * step)) * 4
        sample[i * 4] = data[src]
        sample[i * 4 + 1] = data[src + 1]
        sample[i * 4 + 2] = data[src + 2]
        sample[i * 4 + 3] = data[src + 3]
      }
    }

    const palette = gifenc.quantize(sample, maxColors, { format: 'rgb565' })
    const index = gifenc.applyPalette(data, palette, 'rgb565')

    // Best per-palette-entry alpha is the average alpha of the pixels using it.
    const alphaSum = new Float64Array(palette.length)
    const alphaCount = new Uint32Array(palette.length)
    for (let i = 0; i < index.length; i += 1) {
      const entry = index[i]
      alphaSum[entry] += data[i * 4 + 3]
      alphaCount[entry] += 1
    }
    const alpha = new Uint8Array(palette.length)
    for (let i = 0; i < palette.length; i += 1) {
      alpha[i] = alphaCount[i] > 0 ? Math.round(alphaSum[i] / alphaCount[i]) : 255
    }

    const bytes = await buildIndexedPng({ width, height, palette, index, alpha })
    // Wrap in a fresh Uint8Array so the Blob part is ArrayBuffer-backed.
    return new Blob([new Uint8Array(bytes)], { type: 'image/png' })
  } catch {
    // Never fail the compression job because of a palette/stream hiccup.
    return canvasToBlob(canvas, 'image/png')
  }
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

// Web-safe font stacks for canvas text rendering and font-picker previews.
export const FONT_STACKS: Record<string, string> = {
  Arial: 'Arial, Helvetica, sans-serif',
  Verdana: 'Verdana, Geneva, sans-serif',
  Tahoma: 'Tahoma, Verdana, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", Helvetica, sans-serif',
  Impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  'Courier New': '"Courier New", Courier, monospace',
  'Comic Sans MS': '"Comic Sans MS", "Comic Sans", cursive',
  'Palatino Linotype': '"Palatino Linotype", "Book Antiqua", Palatino, serif',
}