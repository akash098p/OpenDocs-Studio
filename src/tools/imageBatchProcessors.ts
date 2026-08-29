import { ToolFile, ToolOutput, ToolParams } from './types'
import { canvasToBlob, fileExtension, fileName, getFiles, loadImage, makeZip, mimeFor, numberParam, sanitizeFilename, stringParam } from './helpers'
import { drawCanvas, Progress } from './imageProcessors'
import { renderAlbum } from './albumRenderer'

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
  const filesIn = getFiles(files, 'images')
  if (!filesIn.length) throw new Error('Provide at least one image.')

  onProgress?.(5, 'Loading images…')
  const loaded: HTMLImageElement[] = []
  for (let i = 0; i < filesIn.length; i += 1) {
    onProgress?.(5 + Math.round((i / filesIn.length) * 55), `Loading ${i + 1}/${filesIn.length}…`)
    loaded.push(await loadImage(filesIn[i].blob))
  }

  onProgress?.(70, 'Composing album…')
  const canvas = renderAlbum({
    images: loaded,
    template: stringParam(params, 'template', 'classic'),
    thumbW: numberParam(params, 'thumbW', 480),
    thumbH: numberParam(params, 'thumbH', 360),
    columns: numberParam(params, 'columns', 3),
    spacing: numberParam(params, 'spacing', 12),
    fit: stringParam(params, 'fit', 'cover') === 'stretch' ? 'stretch' : 'cover',
    cornerRadius: numberParam(params, 'cornerRadius', 0),
    frameWidth: numberParam(params, 'frameWidth', 0),
    frameColor: stringParam(params, 'frameColor', '#FFFFFF'),
    background: stringParam(params, 'background', '#FFFFFF'),
  })

  onProgress?.(90, 'Encoding…')
  const format = stringParam(params, 'format', 'png')
  const blob = await canvasToBlob(canvas, mimeFor(format), format === 'jpg' ? 0.9 : undefined)
  onProgress?.(100, 'Done.')
  return [{ name: `album-image.${format}`, blob }]
}