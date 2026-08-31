import { ToolFile, ToolOutput, ToolParams } from './types'
import {
  canvasToBlob,
  canvasToCompressedPng,
  fileExtension,
  fileName,
  FONT_STACKS,
  getFile,
  getFiles,
  loadImage,
  makeZip,
  mimeFor,
  numberParam,
  sanitizeFilename,
  stringParam,
  supportsAlpha,
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
  transparent = false,
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
  if (transparent) {
    // Clear the canvas so the image's alpha channel is preserved.
    ctx.clearRect(0, 0, width, height)
  } else {
    // JPG / BMP / other no-alpha formats — flatten onto white to avoid
    // dark or weird-color "transparent" pixels in the final image.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
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
  const ext = fileExtension(getFile(files, 'image').name) || 'png'
  const canvas = drawCanvas(image, outW, outH, smoothing, supportsAlpha(ext))
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

/** Binary-search the palette size that lands a compressed PNG at or below the target size. */
const findPngColorCountForTargetSize = async (image: HTMLImageElement, target: number): Promise<Blob> => {
  let low = 2
  let high = 256
  let best: Blob | null = null
  for (let iter = 0; iter < 7; iter += 1) {
    const colors = Math.round((low + high) / 2)
    const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight, 'high', true)
    const blob = await canvasToCompressedPng(canvas, colors)
    if (!best || blob.size < best.size) best = blob
    if (blob.size <= target) low = colors
    else high = colors
  }
  // One final pass at the lower bound to be sure we land at or below target.
  const finalCanvas = drawCanvas(image, image.naturalWidth, image.naturalHeight, 'high', true)
  const finalBlob = await canvasToCompressedPng(finalCanvas, low)
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

  // PNG color-count derived from the same quality slider (1–100 → 8–256 colors).
  const pngColors = Math.max(8, Math.round((qualityPct / 100) * 256))
  // Quality as 0..1 used by native lossy encoders (JPG / WebP).
  const q = percentToJpegQuality(qualityPct)

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Compressing ${i + 1}/${images.length}...`)

    const srcExt = fileExtension(file.name) || "png"
    // "auto" keeps the source format, so PNG sources get the PNG path below.
    const ext = format === "auto" ? srcExt : format
    const normalizedExt = ext === "jpeg" ? "jpg" : ext

    onProgress?.(Math.round((i / images.length) * 90) + 5, `Loading ${file.name}...`)
    const image = await loadImage(file.blob)
    // Preserve alpha when the chosen output format supports it (PNG/WebP/etc);
    // flatten onto white otherwise (JPG / cross-format lossless).
    const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight, 'high', supportsAlpha(normalizedExt))

    let blob: Blob
    if (isLossyExt(normalizedExt)) {
      const mime = lossyMime(normalizedExt)!
      if (mode === "targetSize") {
        blob = await findQualityForTargetSize(image, mime, target)
      } else {
        blob = await compressAtQuality(canvas, mime, q)
      }
      // If the re-encoded blob is bigger than the source, return the source.
      if (blob.size > file.blob.size) blob = file.blob
    } else if (normalizedExt === "png") {
      // PNG (incl. "auto" on a PNG source): re-encode as an indexed PNG with a
      // reduced palette so the file can actually shrink. Color count follows
      // the quality slider; target-size mode binary-searches the palette size.
      if (mode === "targetSize") {
        blob = await findPngColorCountForTargetSize(image, target)
      } else {
        blob = await canvasToCompressedPng(canvas, pngColors)
      }
      // Never return a larger file than the input when re-compressing a PNG.
      if (srcExt === "png" && blob.size > file.blob.size) blob = file.blob
    } else if (normalizedExt === srcExt) {
      // Same-format BMP: BMP is an uncompressed format — nothing to save.
      blob = file.blob
    } else {
      // Cross-format lossless target (e.g. JPG or PNG -> BMP): use the target
      // format instead of re-encoding the pixels as JPEG.
      blob = await canvasToBlob(canvas, mimeFor(normalizedExt))
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

  const normalizedFormat = format === 'jpeg' ? 'jpg' : format
  const mime = mimeFor(normalizedFormat)
  // Quality is only passed through to lossy encoders (JPG, WebP, AVIF).
  // PNG, BMP, GIF and ICO encode losslessly and ignore it.
  const outQuality =
    normalizedFormat === 'jpg' || normalizedFormat === 'webp' || normalizedFormat === 'avif'
      ? Math.max(0.1, Math.min(1, quality))
      : undefined

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Converting ${i + 1}/${images.length}…`)
    const image = await loadImage(file.blob)
    const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight, 'high', supportsAlpha(normalizedFormat))
    const blob = await canvasToBlob(canvas, mime, outQuality)
    outputs.push({ name: `converted-${file.name.replace(/\.[^.]+$/, '')}.${normalizedFormat}`, blob })
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
  const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight, 'high', supportsAlpha(ext))

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
  // Output extension — used to decide whether to preserve transparency (PNG/WebP/...)
  // or flatten onto white (JPG / other no-alpha formats).
  const ext = fileExtension(input.name) || 'png'

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
  // Keep alpha when the output format supports it (PNG / WebP / etc.).
  if (!supportsAlpha(ext)) {
    rotCtx.fillStyle = '#ffffff'
    rotCtx.fillRect(0, 0, rotW, rotH)
  } else {
    rotCtx.clearRect(0, 0, rotW, rotH)
  }
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
  if (!supportsAlpha(ext)) {
    outCtx.fillStyle = '#ffffff'
    outCtx.fillRect(0, 0, cw, ch)
  } else {
    outCtx.clearRect(0, 0, cw, ch)
  }
  outCtx.drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, cw, ch)

  onProgress?.(90, 'Encoding…')
  const blob = await canvasToBlob(outCanvas, mimeFor(ext), 0.92)
  onProgress?.(100, 'Done.')
  return [{ name: outputName(input, 'cropped', ext), blob }]
}
// ---------------------------------------------------------------------------
// Image Flip / Mirror — mirrors via canvas transforms; keeps alpha intact
// ---------------------------------------------------------------------------
export const imageFlip = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const direction = stringParam(params, 'direction', 'horizontal')
  const format = stringParam(params, 'format', 'keep')
  const images = getFiles(files, 'image')
  if (!images.length) throw new Error('Provide at least one image.')

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Flipping ${i + 1}/${images.length}…`)
    const image = await loadImage(file.blob)
    const width = image.naturalWidth
    const height = image.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context.')

    const srcExt = fileExtension(file.name) || 'png'
    const ext = format === 'keep' ? srcExt : format
    const isJpg = ext === 'jpg' || ext === 'jpeg'
    if (isJpg) {
      // JPG has no alpha channel — flatten onto white first; other formats keep transparency.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.save()
    if (direction === 'horizontal' || direction === 'both') {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    if (direction === 'vertical' || direction === 'both') {
      ctx.translate(0, height)
      ctx.scale(1, -1)
    }
    ctx.drawImage(image, 0, 0, width, height)
    ctx.restore()

    const blob = await canvasToBlob(canvas, mimeFor(ext), isJpg ? 0.92 : undefined)
    outputs.push({ name: outputName(file, 'flipped', ext), blob })
  }

  onProgress?.(100, 'Done.')
  return outputs.length === 1 ? outputs : [{ name: 'flipped-images.zip', blob: await makeZip(outputs) }]
}
// ---------------------------------------------------------------------------
// Adjustments & Enhancement
//   Brightness / contrast / saturation / hue / blur / sepia / grayscale ride on
//   the canvas filter pipeline; color temperature and sharpening run as
//   per-pixel passes on top of the filtered result.
// ---------------------------------------------------------------------------
const clampRange = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

// Cool ↔ warm tint: nudges red up and blue down (and vice versa); green untouched.
const applyTemperature = (data: Uint8ClampedArray, temperature: number): void => {
  const t = temperature / 100
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * (1 + 0.3 * t)
    data[i + 2] = data[i + 2] * (1 - 0.3 * t)
  }
}

// 3x3 unsharp kernel: center weight 1+4a, orthogonal neighbors -a. Border pixels stay untouched.
const applySharpen = (data: Uint8ClampedArray, width: number, height: number, amount: number): void => {
  const source = new Uint8ClampedArray(data)
  const center = 1 + 4 * amount
  const rowBytes = width * 4
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * rowBytes + x * 4
      for (let c = 0; c < 3; c += 1) {
        data[idx + c] =
          center * source[idx + c] -
          amount * (source[idx - 4 + c] + source[idx + 4 + c] + source[idx - rowBytes + c] + source[idx + rowBytes + c])
      }
    }
  }
}

export interface AdjustRenderOptions {
  /** Downscale so the longest edge fits this size (used by the live preview). */
  maxWidth?: number
  /** Pre-fill with white before drawing — JPG output has no alpha channel. */
  flatten?: boolean
}

// Core adjustment pipeline shared by the tool export and the live preview:
// canvas filter pass (brightness/contrast/saturation/hue/blur/sepia/grayscale)
// followed by the temperature and sharpen per-pixel passes. The blur radius
// scales with the render size so a downscaled preview looks like the export.
// Returns a fresh canvas on every call, so repeated renders never compound.
export const renderAdjustments = (
  source: HTMLImageElement | HTMLCanvasElement,
  params: ToolParams,
  options: AdjustRenderOptions = {},
): HTMLCanvasElement => {
  const srcWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const srcHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const scale = options.maxWidth ? Math.min(1, options.maxWidth / Math.max(srcWidth, srcHeight)) : 1
  const width = Math.max(1, Math.round(srcWidth * scale))
  const height = Math.max(1, Math.round(srcHeight * scale))

  const brightness = clampRange(numberParam(params, 'brightness', 0), -100, 100)
  const contrast = clampRange(numberParam(params, 'contrast', 0), -100, 100)
  const saturation = clampRange(numberParam(params, 'saturation', 0), -100, 100)
  const temperature = clampRange(numberParam(params, 'temperature', 0), -100, 100)
  const hue = clampRange(numberParam(params, 'hue', 0), -180, 180)
  const sharpen = clampRange(numberParam(params, 'sharpen', 0), 0, 100)
  const blur = clampRange(numberParam(params, 'blur', 0), 0, 50) * scale
  const sepia = clampRange(numberParam(params, 'sepia', 0), 0, 100)
  const grayscale = clampRange(numberParam(params, 'grayscale', 0), 0, 100)

  const filters: string[] = []
  if (brightness) filters.push(`brightness(${(100 + brightness) / 100})`)
  if (contrast) filters.push(`contrast(${(100 + contrast) / 100})`)
  if (saturation) filters.push(`saturate(${(100 + saturation) / 100})`)
  if (hue) filters.push(`hue-rotate(${hue}deg)`)
  if (blur) filters.push(`blur(${blur}px)`)
  if (sepia) filters.push(`sepia(${sepia / 100})`)
  if (grayscale) filters.push(`grayscale(${grayscale / 100})`)
  const filter = filters.join(' ')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')
  if (options.flatten) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  if (filter) ctx.filter = filter
  ctx.drawImage(source, 0, 0, width, height)
  ctx.filter = 'none'

  if (temperature || sharpen) {
    const imageData = ctx.getImageData(0, 0, width, height)
    if (temperature) applyTemperature(imageData.data, temperature)
    if (sharpen) applySharpen(imageData.data, width, height, sharpen / 100)
    ctx.putImageData(imageData, 0, 0)
  }
  return canvas
}

export const imageAdjust = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const images = getFiles(files, 'image')
  if (!images.length) throw new Error('Provide at least one image.')
  const format = stringParam(params, 'format', 'keep')

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Adjusting ${i + 1}/${images.length}…`)
    const image = await loadImage(file.blob)
    const srcExt = fileExtension(file.name) || 'png'
    const ext = format === 'keep' ? srcExt : format
    const isJpg = ext === 'jpg' || ext === 'jpeg'
    // renderAdjustments pre-fills white for JPG so the output has no dark transparent corners.
    const canvas = renderAdjustments(image, params, { flatten: isJpg })

    const blob = await canvasToBlob(canvas, mimeFor(ext), isJpg ? 0.92 : undefined)
    outputs.push({ name: outputName(file, 'adjusted', ext), blob })
  }

  onProgress?.(100, 'Done.')
  return outputs.length === 1 ? outputs : [{ name: 'adjusted-images.zip', blob: await makeZip(outputs) }]
}
// ---------------------------------------------------------------------------
// Base64 Converter
//   encode: image file(s) → .txt holding a data URI (default) or raw Base64
//   decode: Base64 / data-URI text file → the original binary file
// ---------------------------------------------------------------------------
const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(blob)
  })

// Magic-byte sniffing so decoded files get the right name and MIME type.
const sniffFileExtension = (bytes: Uint8Array): string => {
  const startsWith = (offset: number, text: string): boolean => {
    for (let i = 0; i < text.length; i += 1) {
      if (bytes[offset + i] !== text.charCodeAt(i)) return false
    }
    return true
  }
  if (startsWith(0, '\x89PNG')) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (startsWith(0, 'GIF8')) return 'gif'
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp'
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return 'ico'
  if (startsWith(0, 'RIFF') && startsWith(8, 'WEBP')) return 'webp'
  if (startsWith(4, 'ftyp') && (startsWith(8, 'avif') || startsWith(8, 'avis'))) return 'avif'
  if (startsWith(0, '<?xml') || startsWith(0, '<svg')) return 'svg'
  if (startsWith(0, '%PDF')) return 'pdf'
  return ''
}

export const base64Convert = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const mode = stringParam(params, 'mode', 'encode')

  if (mode === 'decode') {
    const textFiles = getFiles(files, 'text')
    if (!textFiles.length) throw new Error('Provide a text file containing Base64 data.')
    onProgress?.(15, 'Reading Base64…')

    let raw = (await textFiles[0].blob.text()).trim()
    let declaredMime = ''
    const dataUri = raw.match(/^data:([^;,]*)(;base64)?,/i)
    if (dataUri) {
      declaredMime = dataUri[1].toLowerCase()
      raw = raw.slice(dataUri[0].length)
    }
    // Tolerate line breaks and the URL-safe alphabet before validating.
    const b64 = raw.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) throw new Error('The file does not contain any Base64 data.')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error('The file does not look like valid Base64.')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)

    let binary: string
    try {
      binary = atob(padded)
    } catch {
      throw new Error('The file does not look like valid Base64.')
    }
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/avif': 'avif',
      'image/x-icon': 'ico',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
    }
    const ext = sniffFileExtension(bytes) || mimeToExt[declaredMime] || 'bin'
    const blob = new Blob([bytes], { type: ext === 'bin' ? 'application/octet-stream' : mimeFor(ext) })
    onProgress?.(100, 'Done.')
    return [{ name: `decoded-${sanitizeFilename(fileName(textFiles[0].name))}.${ext}`, blob }]
  }

  const images = getFiles(files, 'image')
  if (!images.length) throw new Error('Provide at least one image to encode.')
  const asRawBase64 = stringParam(params, 'output', 'data-uri') === 'raw base64'

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 90) + 5, `Encoding ${i + 1}/${images.length}…`)
    const dataUri = await readAsDataUrl(file.blob)
    const text = asRawBase64 ? dataUri.slice(dataUri.indexOf(',') + 1) : dataUri
    outputs.push({ name: outputName(file, 'base64', 'txt'), blob: new Blob([text], { type: 'text/plain' }) })
  }

  onProgress?.(100, 'Done.')
  return outputs.length === 1 ? outputs : [{ name: 'base64-texts.zip', blob: await makeZip(outputs) }]
}
