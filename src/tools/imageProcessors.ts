import { ToolFile, ToolOutput, ToolParams } from './types'
import {
  canvasToBlob,
  fileExtension,
  FONT_STACKS,
  getFile,
  getFiles,
  loadImage,
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
// ---------------------------------------------------------------------------
export const imageCompress = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const quality = numberParam(params, 'quality', 80) / 100
  const format = stringParam(params, 'format', 'auto')
  const file = getFile(files, 'image')
  const srcExt = fileExtension(file.name) || 'png'
  const ext = format === 'auto' ? srcExt : format

  onProgress?.(10, 'Loading image…')
  const image = await loadImage(file.blob)
  const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)

  let mime: string
  let outQuality: number | undefined
  if (ext === 'jpg' || ext === 'jpeg') {
    mime = 'image/jpeg'
    outQuality = Math.max(0.1, Math.min(1, quality * 0.9))
  } else if (ext === 'webp') {
    mime = 'image/webp'
    outQuality = Math.max(0.1, Math.min(1, quality))
  } else {
    mime = 'image/png'
    outQuality = undefined
  }

  onProgress?.(50, 'Compressing…')
  const blob = await canvasToBlob(canvas, mime, outQuality)
  onProgress?.(100, 'Done.')
  return [{ name: outputName(file, 'compressed', ext === 'jpeg' ? 'jpg' : ext), blob }]
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