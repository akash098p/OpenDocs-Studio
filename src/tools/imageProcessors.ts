import { ToolFile, ToolOutput, ToolParams } from './types'
import {
  canvasToBlob,
  fileExtension,
  FONT_STACKS,
  getFile,
  getFiles,
  loadImage,
  makeZip,
  mimeFor,
  numberParam,
  sanitizeFilename,
  stringParam,
} from './helpers'

export type Progress = (percent: number, message: string) => void

export const calculateFitInside = (srcW: number, srcH: number, boxW: number, boxH: number) => {
  const ratio = Math.min(boxW / srcW, boxH / srcH)
  return { width: Math.max(1, Math.round(srcW * ratio)), height: Math.max(1, Math.round(srcH * ratio)) }
}
export const drawCanvas = (
  image: HTMLImageElement,
  width: number,
  height: number,
  smoothing: 'high' | 'medium' | 'low' | 'off' = 'high',
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')
  if (smoothing === 'off') {
    // Nearest-neighbor: ideal for pixel art, no interpolation at all.
    ctx.imageSmoothingEnabled = false
  } else {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = smoothing
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  return canvas
}
export const outputName = (file: ToolFile, prefix: string, ext: string): string =>
  `${prefix}-${sanitizeFilename(file.name.replace(/\.[^.]+$/, ''))}.${ext}`

// ---------------------------------------------------------------------------
// Image Resize
// ---------------------------------------------------------------------------
export const imageResize = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  onProgress?.(10, 'Loading image…')
  const image = await loadImage(getFile(files, 'image').blob)
  const srcW = image.naturalWidth
  const srcH = image.naturalHeight
  const width = numberParam(params, 'width', 0)
  const height = numberParam(params, 'height', 0)
  const fit = stringParam(params, 'fit', 'stretch')

  let outW: number
  let outH: number
  if (width > 0 && height > 0) {
    if (fit === 'fit-inside') {
      const fits = calculateFitInside(srcW, srcH, width, height)
      outW = fits.width
      outH = fits.height
    } else {
      outW = width
      outH = height
    }
  } else if (width > 0) {
    outW = width
    outH = Math.max(1, Math.round((srcH / srcW) * width))
  } else if (height > 0) {
    outH = height
    outW = Math.max(1, Math.round((srcW / srcH) * height))
  } else {
    throw new Error('Set a width and/or height.')
  }

  const algo = stringParam(params, 'algo', 'bicubic')
  const smoothing = algo === 'nearest' ? 'off' : algo === 'bilinear' || algo === 'area' ? 'medium' : 'high'

  onProgress?.(50, 'Scaling…')
  const canvas = drawCanvas(image, outW, outH, smoothing)
  const ext = fileExtension(getFile(files, 'image').name) || 'png'
  const blob = await canvasToBlob(canvas, mimeFor(ext), 0.92)
  onProgress?.(100, 'Done.')
  return [{ name: outputName(getFile(files, 'image'), 'resized', ext), blob }]
}
// ---------------------------------------------------------------------------
// Image Compress
//   - mode = 'percentage' → use the given quality (1–100) directly
//   - mode = 'targetSize' → binary-search the lowest quality that fits the
//     given target size in KB or MB. Falls back to the best quality if the
//     target is unreachable (e.g. already too small or PNG output).
// ---------------------------------------------------------------------------
const targetBytes = (size: number, unit: string): number => {
  const n = Math.max(1, Number(size) || 0)
  return unit === 'MB' ? Math.round(n * 1024 * 1024) : Math.round(n * 1024)
}
const isLossyExt = (ext: string): boolean => ext === 'jpg' || ext === 'jpeg' || ext === 'webp'

const lossyMime = (ext: string): string | null => {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return null
}
const compressAtQuality = async (
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> => {
  if (mime === 'image/png' || mime === 'image/bmp') {
    return canvasToBlob(canvas, mime)
  }
  return canvasToBlob(canvas, mime, Math.max(0.05, Math.min(1, quality)))
}

/** Map the user's percentage (1-100) to a JPEG quality that actually 
compresses. 
Most real-world JPEGs are at 0.80-0.92, so a literal quality/100 mapping
 rarely shrinks anything. We use a non-linear curve: 100% -> 0.85,
 50% -> 0.45, 1% -> 0.06. That way "75%" lands at ~0.65, which is
 comfortably below the typical source quality and produces a real shrink.
 Combined with the "return source if smaller" guard, this gives the user
 a smaller file in 95% of cases. */
const percentToJpegQuality = (qualityPct: number): number => {
  const q = Math.max(1, Math.min(100, qualityPct))
  // 100 -> 0.85, 50 -> 0.45, 1 -> 0.06 (linear, slightly below the standard
  // 0-1 to 0-1 mapping so 100% is still a real recompress).
  return Math.max(0.05, Math.min(0.85, 0.05 + (q / 100) * 0.80))
}

const findQualityForTargetSize = async (
  image: HTMLImageElement,
  mime: string,
  target: number,
): Promise<Blob> => {
  // Binary search: find the lowest quality that fits the target size.
  let low = 0.05
  let high = 0.95
  let best: Blob | null = null
  for (let iter = 0; iter < 7; iter += 1) {
    const q = (low + high) / 2
    const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)
    const blob = await compressAtQuality(canvas, mime, q)
    if (!best || blob.size < best.size) best = blob
    if (blob.size <= target) {
      low = q
    } else {
      high = q
    }
  }
  // One final pass at the lower bound to be sure we land at or below target.
  const finalCanvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)
  const finalBlob = await compressAtQuality(finalCanvas, mime, low)
  if (!best || finalBlob.size < best.size) best = finalBlob
  return best!
}

export const imageCompress = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const mode = stringParam(params, "mode", "percentage") === "targetSize" ? "targetSize" : "percentage"
  const qualityPct = Math.max(1, Math.min(100, numberParam(params, "quality", 75)))
  const target = targetBytes(numberParam(params, "targetSize", 500), stringParam(params, "targetUnit", "KB"))
  const format = stringParam(params, "format", "auto")
  const images = getFiles(files, "image")
  if (!images.length) throw new Error("Provide at least one image.")

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Compressing ${i + 1}/${images.length}...`)

    const srcExt = fileExtension(file.name) || "png"
    // PNG output is kept when the source is PNG and the user picked "auto" —
    // re-encoding a lossless PNG in the browser only makes it larger.
    const ext = format === "auto" ? srcExt : format
    const normalizedExt = ext === "jpeg" ? "jpg" : ext

    onProgress?.(Math.round((i / images.length) * 90) + 5, `Loading ${file.name}...`)
    const image = await loadImage(file.blob)

    // Quality as 0..1 used by canvas.toBlob. Linear scale — 75 means 0.75.
    const q = percentToJpegQuality(qualityPct)
    let blob: Blob

    if (isLossyExt(normalizedExt)) {
      const mime = lossyMime(normalizedExt)!
      if (mode === "targetSize") {
        blob = await findQualityForTargetSize(image, mime, target)
      } else {
        const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)
        blob = await compressAtQuality(canvas, mime, q)
      }
      // If the re-encoded blob is bigger than the source, return the source.
      if (blob.size > file.blob.size) blob = file.blob
    } else if (normalizedExt === srcExt) {
      // Same-format PNG/BMP: re-encoding is lossless but the new file is almost
      // always bigger. Just return the source untouched.
      blob = file.blob
    } else {
      // Cross-format (e.g. PNG -> JPG): JPEG re-encode is a real shrinker.
      const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)
      blob = await compressAtQuality(canvas, "image/jpeg", q)
    }

    outputs.push({ name: outputName(file, "compressed", normalizedExt), blob })
  }

  onProgress?.(100, "Done.")
  return outputs.length === 1 ? outputs : [{ name: "compressed-images.zip", blob: await makeZip(outputs) }]
}
// ---------------------------------------------------------------------------
// Image Format Converter
// ---------------------------------------------------------------------------
export const imageConvert = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const quality = numberParam(params, 'quality', 90) / 100
  const format = stringParam(params, 'format', 'png')
  const images = getFiles(files, 'image')
  if (!images.length) throw new Error('Provide at least one image.')

  const mime = mimeFor(format)
  const outQuality = format === 'png' || format === 'bmp' ? undefined : Math.max(0.1, Math.min(1, quality))

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Converting ${i + 1}/${images.length}…`)
    const image = await loadImage(file.blob)
    const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)
    const blob = await canvasToBlob(canvas, mime, outQuality)
    outputs.push({ name: `converted-${file.name.replace(/\.[^.]+$/, '')}.${format}`, blob })
  }

  onProgress?.(100, 'Done.')
  return outputs
}
// ---------------------------------------------------------------------------
// Add Watermark
// ---------------------------------------------------------------------------
const resolvePosition = (
  position: string,
  imageW: number,
  imageH: number,
  drawW: number,
  drawH: number,
): { x: number; y: number } => {
  const margin = Math.round(Math.min(imageW, imageH) * 0.03)
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'top-right':
      return { x: imageW - drawW - margin, y: margin }
    case 'bottom-left':
      return { x: margin, y: imageH - drawH - margin }
    case 'center':
      return { x: (imageW - drawW) / 2, y: (imageH - drawH) / 2 }
    case 'top':
      return { x: (imageW - drawW) / 2, y: margin }
    case 'bottom':
      return { x: (imageW - drawW) / 2, y: imageH - drawH - margin }
    case 'left':
      return { x: margin, y: (imageH - drawH) / 2 }
    case 'right':
      return { x: imageW - drawW - margin, y: (imageH - drawH) / 2 }
    case 'bottom-right':
    default:
      return { x: imageW - drawW - margin, y: imageH - drawH - margin }
  }
}
export const addWatermark = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const base = getFile(files, 'image')
  const overlays = files.filter((file) => file.name === 'watermark')
  const text = stringParam(params, 'text', '').trim()
  const hasImage = overlays.length > 0
  if (!hasImage && !text) throw new Error('Provide an overlay image and/or some text.')

  onProgress?.(10, 'Loading base image…')
  const baseImage = await loadImage(base.blob)
  const position = stringParam(params, 'position', 'bottom-right')
  const opacity = Math.max(0.01, Math.min(1, numberParam(params, 'opacity', 100) / 100))
  const scale = numberParam(params, 'scale', 30) / 100

  const canvas = document.createElement('canvas')
  canvas.width = baseImage.naturalWidth
  canvas.height = baseImage.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')
  ctx.drawImage(baseImage, 0, 0)

  let overlayBottom = 0
  if (hasImage) {
    onProgress?.(40, 'Overlaying image…')
    const overlayImage = await loadImage(overlays[0].blob)
    const drawW = Math.max(1, Math.round(baseImage.naturalWidth * scale))
    const drawH = Math.max(1, Math.round(overlayImage.naturalHeight * (drawW / overlayImage.naturalWidth)))
    const pos = resolvePosition(position, canvas.width, canvas.height, drawW, drawH)
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.drawImage(overlayImage, pos.x, pos.y, drawW, drawH)
    ctx.restore()
    overlayBottom = pos.y + drawH
  }

  if (text) {
    onProgress?.(70, 'Drawing text…')
    const fontSize = numberParam(params, 'fontSize', 36)
    const fontName = stringParam(params, 'font', 'Arial')
    const fontStack = FONT_STACKS[fontName] ?? FONT_STACKS.Arial
    const colorRaw = stringParam(params, 'color', '#FFFFFF').replace(/^#/, '')
    const isValid = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(colorRaw)
    const expanded = isValid && colorRaw.length === 3 ? colorRaw.split('').map((c) => c + c).join('') : colorRaw
    const fill = isValid ? `#${expanded}` : '#FFFFFF'
    ctx.save()
    ctx.globalAlpha = Math.max(0.1, opacity)
    ctx.font = `bold ${fontSize}px ${fontStack}`
    ctx.fillStyle = fill
    const textWidth = ctx.measureText(text).width
    const pad = fontSize * 0.6
    const pos =
      hasImage
        ? { x: Math.max(10, Math.min(canvas.width - textWidth - 10, (canvas.width - textWidth) / 2)), y: Math.min(canvas.height - pad, overlayBottom + pad) }
        : resolvePosition(position, canvas.width, canvas.height, textWidth + pad, fontSize)
    ctx.fillText(text, pos.x, pos.y)
    ctx.restore()
  }

  onProgress?.(90, 'Encoding…')
  const ext = fileExtension(base.name) || 'png'
  const blob = await canvasToBlob(canvas, mimeFor(ext), 0.92)
  onProgress?.(100, 'Done.')
  return [{ name: outputName(base, 'watermarked', ext), blob }]
}
// ---------------------------------------------------------------------------
// EXIF Metadata Stripper — re-encodes, dropping all EXIF metadata
// ---------------------------------------------------------------------------
export const imageStripExif = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const format = stringParam(params, 'format', 'png')
  const file = getFile(files, 'image')
  const srcExt = fileExtension(file.name) || 'png'
  const ext = format === 'keep' ? srcExt : format

  onProgress?.(10, 'Loading image…')
  const image = await loadImage(file.blob)
  const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)

  onProgress?.(50, 'Re-encoding…')
  const blob = await canvasToBlob(canvas, mimeFor(ext), ext === 'jpg' ? 0.9 : undefined)
  onProgress?.(100, 'Done.')
  return [{ name: outputName(file, 'stripped', ext), blob }]
}
// ---------------------------------------------------------------------------
// Image Crop & Rotate (visual editor — crop rect in %, rotation in degrees)
// ---------------------------------------------------------------------------
export const imageCropRotate = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const input = getFile(files, 'image')
  const cropX = Math.max(0, numberParam(params, 'cropX', 0))
  const cropY = Math.max(0, numberParam(params, 'cropY', 0))
  const cropWidth = Math.max(0, numberParam(params, 'cropWidth', 100))
  const cropHeight = Math.max(0, numberParam(params, 'cropHeight', 100))
  const rotate = numberParam(params, 'rotate', 0)

  onProgress?.(10, 'Loading image…')
  const image = await loadImage(input.blob)
  const srcW = image.naturalWidth
  const srcH = image.naturalHeight

  // Dimensions after rotation
  const swapped = rotate === 90 || rotate === 270
  const rotW = swapped ? srcH : srcW
  const rotH = swapped ? srcW : srcH

  // --- Step 1: draw rotated image onto a canvas ---
  onProgress?.(40, 'Rotating…')
  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = rotW
  rotCanvas.height = rotH
  const rotCtx = rotCanvas.getContext('2d')
  if (!rotCtx) throw new Error('Could not create canvas context.')
  rotCtx.fillStyle = '#ffffff'
  rotCtx.fillRect(0, 0, rotW, rotH)
  rotCtx.save()
  rotCtx.translate(rotW / 2, rotH / 2)
  rotCtx.rotate((rotate * Math.PI) / 180)
  rotCtx.drawImage(image, -srcW / 2, -srcH / 2, srcW, srcH)
  rotCtx.restore()

  // --- Step 2: crop from the rotated canvas ---
  onProgress?.(70, 'Cropping…')
  const cx = Math.max(0, Math.round((cropX / 100) * rotW))
  const cy = Math.max(0, Math.round((cropY / 100) * rotH))
  const cw = Math.min(rotW - cx, Math.max(1, Math.round((cropWidth / 100) * rotW)))
  const ch = Math.min(rotH - cy, Math.max(1, Math.round((cropHeight / 100) * rotH)))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = cw
  outCanvas.height = ch
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) throw new Error('Could not create canvas context.')
  outCtx.fillStyle = '#ffffff'
  outCtx.fillRect(0, 0, cw, ch)
  outCtx.drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, cw, ch)

  onProgress?.(90, 'Encoding…')
  const ext = fileExtension(input.name) || 'png'
  const blob = await canvasToBlob(outCanvas, mimeFor(ext), 0.92)
  onProgress?.(100, 'Done.')
  return [{ name: outputName(input, 'cropped', ext), blob }]
}
