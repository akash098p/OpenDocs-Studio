import { PDFDocument, degrees } from 'pdf-lib'
import { ToolFile, ToolOutput, ToolParams } from './types'
import { fileName, getFile, getFiles, loadImage, makeZip, numberParam, sanitizeFilename, stringParam } from './helpers'
import { Progress } from './imageProcessors'

const loadPdf = async (blob: Blob): Promise<PDFDocument> => {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch (error) {
    throw new Error('Not a valid PDF file.')
  }
}

const savePdf = async (doc: PDFDocument): Promise<Blob> => {
  const bytes = await doc.save({ useObjectStreams: true })
  return new Blob([bytes.slice()], { type: 'application/pdf' })
}

// ---------------------------------------------------------------------------
// PDF Merger
// ---------------------------------------------------------------------------
export const pdfMerge = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const pdfs = getFiles(files, 'pdf')
  if (!pdfs.length) throw new Error('Provide at least one PDF.')

  onProgress?.(10, 'Creating document...')
  const doc = await PDFDocument.create()
  for (let i = 0; i < pdfs.length; i += 1) {
    onProgress?.(Math.round((i / pdfs.length) * 80) + 10, `Merging ${i + 1}/${pdfs.length}...`)
    const src = await loadPdf(pdfs[i].blob)
    const copied = await doc.copyPages(src, src.getPageIndices())
    copied.forEach((page) => doc.addPage(page))
  }
  const title = stringParam(params, 'title', '')
  if (title) doc.setTitle(title)

  onProgress?.(95, 'Saving...')
  const blob = await savePdf(doc)
  onProgress?.(100, 'Done.')
  return [{ name: 'merged.pdf', blob }]
}

// ---------------------------------------------------------------------------
// PDF Splitter
// ---------------------------------------------------------------------------
const parseRanges = (value: string): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (const part of String(value || '').split(',')) {
    const p = part.trim()
    if (!p) continue
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(Number)
      if (!Number.isNaN(a) && !Number.isNaN(b)) out.push([a, b])
    } else {
      const n = Number(p)
      if (!Number.isNaN(n)) out.push([n, n])
    }
  }
  if (!out.length) out.push([1, 1])
  return out
}

export const pdfSplit = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const ranges = parseRanges(stringParam(params, 'ranges', '1-3'))

  onProgress?.(10, 'Loading PDF...')
  const src = await loadPdf(file.blob)
  const total = src.getPageCount()
  const base = sanitizeFilename(fileName(file.name)) || 'split'

  const outputs: ToolOutput[] = []
  for (let i = 0; i < ranges.length; i += 1) {
    const [a, b] = ranges[i]
    if (a < 1 || b < 1 || a > b || b > total) {
      throw new Error(`Range ${a}-${b} out of bounds (document has 1-${total}).`)
    }
    onProgress?.(Math.round((i / ranges.length) * 80) + 10, `Extracting ${a}-${b}...`)
    const copy = await PDFDocument.create()
    const indices = Array.from({ length: b - a + 1 }, (_, k) => a - 1 + k)
    const pages = await copy.copyPages(src, indices)
    pages.forEach((page) => copy.addPage(page))
    outputs.push({ name: `${base}-${a}-${b}.pdf`, blob: await savePdf(copy) })
  }

  if (outputs.length === 1) {
    onProgress?.(100, 'Done.')
    return outputs
  }
  onProgress?.(95, 'Bundling...')
  const zip = await makeZip(outputs)
  onProgress?.(100, 'Done.')
  return [{ name: `${base}-split.zip`, blob: zip }]
}
// ---------------------------------------------------------------------------
// PDF Page Rotator
// ---------------------------------------------------------------------------
const turnDegrees = (current: number, delta: number): number => (((current + delta) % 360) + 360) % 360

export const pdfRotate = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const degreesParam = ((numberParam(params, 'degrees', 90) % 360) + 360) % 360
  const all = stringParam(params, 'all', 'all-pages')
  const pageNum = numberParam(params, 'page', 1)

  onProgress?.(10, 'Loading PDF...')
  const doc = await loadPdf(file.blob)

  if (all === 'single-page') {
    const index = pageNum - 1
    if (index < 0 || index >= doc.getPageCount()) {
      throw new Error(`Page ${pageNum} does not exist (document has 1-${doc.getPageCount()}).`)
    }
    const page = doc.getPage(index)
    page.setRotation(degrees(turnDegrees(page.getRotation().angle, degreesParam)))
  } else {
    doc.getPages().forEach((page) => page.setRotation(degrees(turnDegrees(page.getRotation().angle, degreesParam))))
  }

  onProgress?.(60, 'Saving...')
  const blob = await savePdf(doc)
  onProgress?.(100, 'Done.')
  return [{ name: `rotated-${file.name.replace(/\.[^.]+$/, '')}.pdf`, blob }]
}

// ---------------------------------------------------------------------------
// Images to PDF
// ---------------------------------------------------------------------------
export const imagesToPdf = async (files: ToolFile[], _params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const images = getFiles(files, 'images')
  if (!images.length) throw new Error('Provide at least one image.')

  onProgress?.(10, 'Creating document...')
  const doc = await PDFDocument.create()
  for (let i = 0; i < images.length; i += 1) {
    onProgress?.(Math.round((i / images.length) * 80) + 10, `Embedding image ${i + 1}/${images.length}...`)
    const img = await loadImage(images[i].blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context.')
    ctx.drawImage(img, 0, 0)

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) throw new Error('Could not encode the image.')
    const embedded = await doc.embedPng(new Uint8Array(await pngBlob.arrayBuffer()))
    const page = doc.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  }

  onProgress?.(95, 'Saving...')
  const blob = await savePdf(doc)
  onProgress?.(100, 'Done.')
  return [{ name: 'images.pdf', blob }]
}
// ---------------------------------------------------------------------------
// PDF Compressor — re-normalizes with compressed object streams
// ---------------------------------------------------------------------------
export const pdfCompress = async (files: ToolFile[], _params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  onProgress?.(10, 'Loading PDF...')
  const doc = await loadPdf(file.blob)
  onProgress?.(50, 'Saving with compressed object streams...')
  const bytes = await doc.save({ useObjectStreams: true })
  onProgress?.(100, 'Done.')
  return [{ name: 'compressed.pdf', blob: new Blob([bytes.slice()], { type: 'application/pdf' }) }]
}

// ---------------------------------------------------------------------------
// PDF to Images — uses pdfjs-dist to render pages to canvas
// ---------------------------------------------------------------------------
export const pdfToImages = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const format = stringParam(params, 'format', 'png')
  const dpi = numberParam(params, 'dpi', 150)

  onProgress?.(5, 'Initializing renderer...')
  const pdfjsLib = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default as string
  const bytes = new Uint8Array(await file.blob.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise

  const outputs: ToolOutput[] = []
  const scale = dpi / 72
  for (let i = 1; i <= pdf.numPages; i += 1) {
    onProgress?.(Math.round((i / pdf.numPages) * 90), `Rendering page ${i}/${pdf.numPages}...`)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92))
    if (!blob) throw new Error('Could not encode the rendered page.')
    outputs.push({ name: `page-${String(i).padStart(3, '0')}.${format}`, blob })
  }

  onProgress?.(95, 'Bundling ZIP...')
  const zip = await makeZip(outputs)
  onProgress?.(100, 'Done.')
  return [{ name: `${file.name.replace(/\.[^.]+$/, '')}-pages.zip`, blob: zip }]
}