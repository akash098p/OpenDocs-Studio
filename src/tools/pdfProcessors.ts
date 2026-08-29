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
// ---------------------------------------------------------------------------
// PDF Page Rotator
//   `pages` accepts ranges like PDF Splitter: e.g. "1-3,5,7-9".
//   Ranges are inclusive and comma-separated. Empty or "all" rotates every page.
// ---------------------------------------------------------------------------
const turnDegrees = (current: number, delta: number): number => (((current + delta) % 360) + 360) % 360

export const pdfRotate = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const degreesParam = ((numberParam(params, 'degrees', 90) % 360) + 360) % 360
  const pagesParam = stringParam(params, 'pages', 'all')

  onProgress?.(10, 'Loading PDF...')
  const doc = await loadPdf(file.blob)
  const total = doc.getPageCount()

  // Empty / "all" -> apply to every page; otherwise parse the range list.
  const isAll = !pagesParam.trim() || pagesParam.trim().toLowerCase() === 'all'
  const indices: number[] = isAll
    ? Array.from({ length: total }, (_, k) => k)
    : (() => {
        const ranges = parseRanges(pagesParam)
        const result = new Set<number>()
        for (const [a, b] of ranges) {
          if (a < 1 || b < 1 || a > b || b > total) {
            throw new Error(`Page range ${a}-${b} out of bounds (document has 1-${total}).`)
          }
          for (let k = a; k <= b; k += 1) result.add(k - 1)
        }
        return [...result].sort((x, y) => x - y)
      })()

  if (!indices.length) throw new Error('No valid pages to rotate.')

  onProgress?.(40, `Rotating ${indices.length} page${indices.length === 1 ? '' : 's'}...`)
  indices.forEach((idx) => {
    const page = doc.getPage(idx)
    page.setRotation(degrees(turnDegrees(page.getRotation().angle, degreesParam)))
  })

  onProgress?.(80, 'Saving...')
  const blob = await savePdf(doc)
  onProgress?.(100, 'Done.')
  return [{ name: `rotated-${file.name.replace(/\.[^.]+$/, '')}.pdf`, blob }]
}
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
// PDF Compressor
//   - mode = 'percentage' (quality) => re-renders all pages as JPEG at the
//     chosen quality (10-95%), then rebuilds the PDF with pdf-lib.
//   - mode = 'targetSize' => binary-searches the JPEG quality level that
//     keeps the output <= the target size in KB or MB.
// ---------------------------------------------------------------------------

const targetBytesPdf = (size: number, unit: string): number => {
  const n = Math.max(1, Number(size) || 0)
  return unit === 'MB' ? Math.round(n * 1024 * 1024) : Math.round(n * 1024)
}

/** Loads an image from a Blob using the browser Image API. */
const loadImageFromBlob = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Could not decode image.')) }
    img.src = URL.createObjectURL(blob)
  })

/** Renders a pdfjs page to a JPEG Blob. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderPageToJpegBlob = async (page: any, quality: number): Promise<{ width: number; height: number; blob: Blob }> => {
  const viewport = page.getViewport({ scale: 1 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.getOperatorList()
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Could not encode rendered page.')
  return { width: canvas.width, height: canvas.height, blob }
}

/** Renders all pages of a pdfjs document at a given JPEG quality. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderAllPages = async (pdf: any, quality: number, onProgress?: (pct: number, msg: string) => void): Promise<Array<{ width: number; height: number; blob: Blob }>> => {
  const pages: Array<{ width: number; height: number; blob: Blob }> = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    onProgress?.(Math.round((i / pdf.numPages) * 90), `Rendering page ${i}/${pdf.numPages} at ${Math.round(quality * 100)}%`)
    const page = await pdf.getPage(i)
    pages.push(await renderPageToJpegBlob(page, quality))
  }
  return pages
}

/** Re-encodes rendered page blobs into a new PDF with object stream compression. */
const buildPdfFromRenderedPages = async (pages: Array<{ width: number; height: number; blob: Blob }>): Promise<Blob> => {
  const doc = await PDFDocument.create()
  for (const { blob } of pages) {
    const img = await loadImageFromBlob(blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      const jpgBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (jpgBlob) {
        const imgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
        const embedded = await doc.embedJpg(imgBytes)
        doc.addPage([embedded.width, embedded.height])
      }
    }
  }
  const bytes = await doc.save({ useObjectStreams: true })
  return new Blob([bytes.slice()], { type: 'application/pdf' })
}

/** Estimates the output PDF size when re-encoded at a given JPEG quality. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const estimatePdfSize = async (_pdf: any, rendered: Array<{ blob: Blob }>, quality: number): Promise<number> => {
  const doc = await PDFDocument.create()
  for (const { blob } of rendered) {
    const img = await loadImageFromBlob(blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      const jpgBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (jpgBlob) {
        const imgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
        const embedded = await doc.embedJpg(imgBytes)
        doc.addPage([embedded.width, embedded.height])
      }
    }
  }
  const saved = await doc.save({ useObjectStreams: true })
  return saved.byteLength
}

const compressPdfByQuality = async (
  file: ToolFile,
  qualityPct: number,
  onProgress?: (pct: number, msg: string) => void,
): Promise<Blob> => {
  const pdfjsLib = await import('pdfjs-dist')
  const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default as string
  const data = new Uint8Array(await file.blob.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const jpegQ = Math.max(0.1, Math.min(0.95, qualityPct / 100))
  const pages = await renderAllPages(pdf, jpegQ, onProgress)
  return buildPdfFromRenderedPages(pages)
}

const compressPdfToTargetSize = async (
  file: ToolFile,
  target: number,
  onProgress?: (pct: number, msg: string) => void,
): Promise<Blob> => {
  const pdfjsLib = await import('pdfjs-dist')
  const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default as string
  const data = new Uint8Array(await file.blob.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise

  onProgress?.(2, 'Rendering pages at reference quality')
  const rendered = await renderAllPages(pdf, 0.92, onProgress)

  const refSize = await estimatePdfSize(pdf, rendered, 0.92)
  if (refSize <= target) {
    onProgress?.(60, 'PDF already under target - re-encoding at 85% quality')
    return buildPdfFromRenderedPages(rendered)
  }

  // Binary search: quality 0.1 = most compressed, 0.92 = least.
  let low = 0.1
  let high = 0.92
  let best: { quality: number; size: number } | null = null
  for (let iter = 0; iter < 7; iter += 1) {
    const quality = (low + high) / 2
    const size = await estimatePdfSize(pdf, rendered, quality)
    if (!best || size < best.size) best = { quality, size }
    onProgress?.(30 + Math.round((iter / 7) * 50), `Quality ${Math.round(quality * 100)}% -> ${Math.round(size / 1024)} KB`)
    if (size <= target) {
      low = quality
    } else {
      high = quality
    }
  }

  const finalQ = best ? best.quality : 0.5
  onProgress?.(85, `Building final PDF at ${Math.round(finalQ * 100)}% quality`)
  const doc = await PDFDocument.create()
  for (const { blob } of rendered) {
    const img = await loadImageFromBlob(blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      const jpgBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', finalQ))
      if (jpgBlob) {
        const imgBytes = new Uint8Array(await jpgBlob.arrayBuffer())
        const embedded = await doc.embedJpg(imgBytes)
        doc.addPage([embedded.width, embedded.height])
      }
    }
  }
  onProgress?.(95, 'Compressing structure')
  const bytes = await doc.save({ useObjectStreams: true })
  return new Blob([bytes.slice()], { type: 'application/pdf' })
}

export const pdfCompress = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const mode = stringParam(params, "mode", "percentage") === "targetSize" ? "targetSize" : "percentage"
  const qualityPct = Math.max(1, Math.min(100, numberParam(params, "quality", 60)))
  const target = targetBytesPdf(numberParam(params, "targetSize", 500), stringParam(params, "targetUnit", "KB"))
  const pdfs = getFiles(files, "pdf")
  if (!pdfs.length) throw new Error("Provide at least one PDF.")

  const outputs: ToolOutput[] = []
  for (let i = 0; i < pdfs.length; i += 1) {
    const file = pdfs[i]
    onProgress?.(Math.round((i / pdfs.length) * 95) + 5, `Compressing ${i + 1}/${pdfs.length}`)

    let blob: Blob
    if (mode === "targetSize") {
      // If the source is already smaller than the target, return the source untouched.
      if (file.blob.size <= target) {
        onProgress?.(Math.round((i / pdfs.length) * 95) + 5, "Source already under target - keeping original")
        blob = file.blob
      } else {
        blob = await compressPdfToTargetSize(file, target, (p, m) => {
          const base = Math.round((i / pdfs.length) * 90) + 5
          onProgress?.(base + Math.round(p * 0.1), m)
        })
        // If our re-encoded version is still larger than the source, keep the source.
        if (blob.size > file.blob.size) blob = file.blob
      }
    } else {
      blob = await compressPdfByQuality(file, qualityPct, (p, m) => {
        const base = Math.round((i / pdfs.length) * 90) + 5
        onProgress?.(base + Math.round(p * 0.1), m)
      })
      // Re-encoding only helps if it shrinks. Otherwise return the source unchanged.
      if (blob.size > file.blob.size) blob = file.blob
    }

    outputs.push({ name: `compressed-${sanitizeFilename(fileName(file.name) || "doc")}.pdf`, blob })
  }

  onProgress?.(100, "Done.")
  return outputs.length === 1 ? outputs : [{ name: "compressed-pdfs.zip", blob: await makeZip(outputs) }]
}

// ---------------------------------------------------------------------------
// PDF to Images - uses pdfjs-dist to render pages to canvas
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PDF to Images - uses pdfjs-dist to render pages to canvas
//   Returns each rendered page as its own ToolOutput so the OutputPreview
//   pane can show inline image previews. The existing "Download All as ZIP"
//   button in OutputPreview bundles them for a single-file download.
// ---------------------------------------------------------------------------
export const pdfToImages = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const format = stringParam(params, 'format', 'png')
  const dpi = numberParam(params, 'dpi', 150)

  onProgress?.(5, 'Initializing renderer')
  const pdfjsLib = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default as string
  const bytes = new Uint8Array(await file.blob.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise

  const scale = dpi / 72
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
  const quality = mime === 'image/jpeg' ? 0.92 : undefined
  const outputs: ToolOutput[] = []

  for (let i = 1; i <= pdf.numPages; i += 1) {
    onProgress?.(Math.round((i / pdf.numPages) * 90), `Rendering page ${i}/${pdf.numPages}`)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context.')
    // White background so transparent PDF content (and PNG) doesn't look black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))
    if (!blob) throw new Error('Could not encode the rendered page.')
    outputs.push({ name: `page-${String(i).padStart(3, '0')}.${format}`, blob })
  }

  onProgress?.(100, 'Done.')
  return outputs
}
