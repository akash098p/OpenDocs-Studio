import { ToolFile, ToolOutput, ToolParams } from './types'
import { canvasToBlob, fileExtension, fileName, getFiles, loadImage, makeZip, mimeFor, numberParam, sanitizeFilename, stringParam } from './helpers'
import { drawCanvas, Progress } from './imageProcessors'

// ---------------------------------------------------------------------------
// Batch Image Renamer
// ---------------------------------------------------------------------------
export const batchRename = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const images = getFiles(files, 'images')
  if (!images.length) throw new Error('Provide at least one image.')

  const prefix = stringParam(params, 'prefix', '')
  const suffix = stringParam(params, 'suffix', '')
  const numbering = stringParam(params, 'numbering', 'seq')
  const digits = numberParam(params, 'digits', 2)
  const format = stringParam(params, 'format', 'keep')
  const quality = numberParam(params, 'quality', 90) / 100

  const outputs: ToolOutput[] = []
  for (let i = 0; i < images.length; i += 1) {
    const file = images[i]
    onProgress?.(Math.round((i / images.length) * 100), `Processing ${i + 1}/${images.length}...`)
    const base = fileName(file.name)
    const srcExt = fileExtension(file.name) || 'png'
    const ext = format === 'keep' ? srcExt : format
    const seq = numbering === 'seq' ? String(i + 1).padStart(digits, '0') : ''
    const name = sanitizeFilename(prefix + base + suffix + seq + '.' + ext)

    let blob: Blob
    if (format === 'keep') {
      blob = file.blob
    } else {
      const image = await loadImage(file.blob)
      const canvas = drawCanvas(image, image.naturalWidth, image.naturalHeight)
      const outQuality =
        ext === 'jpg' || ext === 'jpeg'
          ? Math.max(0.1, Math.min(1, quality * 0.9))
          : ext === 'webp'
            ? Math.max(0.1, Math.min(1, quality))
            : undefined
      blob = await canvasToBlob(canvas, mimeFor(ext), outQuality)
    }
    outputs.push({ name, blob })
  }

  onProgress?.(100, 'Bundling ZIP...')
  const zip = await makeZip(outputs)
  return [{ name: 'renamed-images.zip', blob: zip }]
}

// ---------------------------------------------------------------------------
// Custom Album Creator
// ---------------------------------------------------------------------------
export const imageAlbum = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const images = getFiles(files, 'images')
  if (!images.length) throw new Error('Provide at least one image.')

  const thumbW = numberParam(params, 'thumbW', 480)
  const thumbH = numberParam(params, 'thumbH', 360)
  const columns = Math.max(1, numberParam(params, 'columns', 3))
  const spacing = numberParam(params, 'spacing', 8)
  const fit = stringParam(params, 'fit', 'stretch')
  const colorRaw = stringParam(params, 'color', '000000').replace(/^#/, '')
  const format = stringParam(params, 'format', 'png')
  const rows = Math.ceil(images.length / columns)
  const outW = Math.max(1, thumbW * columns + spacing * (columns - 1))
  const outH = Math.max(1, thumbH * rows + spacing * (rows - 1))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')

  const isValidColor = /^([0-9a-fA-F]{6})$/.test(colorRaw)
  ctx.fillStyle = isValidColor ? `#${colorRaw}` : colorRaw || '#000000'
  ctx.fillRect(0, 0, outW, outH)

  for (let i = 0; i < images.length; i += 1) {
    onProgress?.(Math.round((i / images.length) * 100), `Placing photo ${i + 1}/${images.length}...`)
    const img = await loadImage(images[i].blob)
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = col * (thumbW + spacing)
    const y = row * (thumbH + spacing)

    if (fit === 'cover') {
      const scale = Math.max(thumbW / img.naturalWidth, thumbH / img.naturalHeight)
      const sx = (img.naturalWidth - thumbW / scale) / 2
      const sy = (img.naturalHeight - thumbH / scale) / 2
      ctx.drawImage(img, sx, sy, thumbW / scale, thumbH / scale, x, y, thumbW, thumbH)
    } else {
      ctx.drawImage(img, x, y, thumbW, thumbH)
    }
  }

  onProgress?.(90, 'Encoding...')
  const blob = await canvasToBlob(canvas, mimeFor(format), format === 'jpg' ? 0.9 : undefined)
  onProgress?.(100, 'Done.')
  return [{ name: `album-image.${format}`, blob }]
}