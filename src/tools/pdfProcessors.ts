import { PDFDocument, PDFFont, PDFImage, StandardFonts, degrees, rgb } from 'pdf-lib'
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
// ---------------------------------------------------------------------------
// PDF Compressor
//
// History: the previous version re-encoded pages through a canvas twice —
// once to produce a JPEG at the user’s quality, and a second time at
// hard-coded quality 0.92 to "match the source structure". The second
// round-trip was wasted work and on some browsers it produced blank
// pages because the JPEG bytes fed to pdf-lib had subtly different
// header markers than the first encoding.
//
// This rewrite uses one encode pass per page at the user’s chosen quality
// and feeds the resulting JPEG bytes directly to embedJpg. The percentage
// mapping and the render scale both drop as quality drops, so a 50% pass
// actually shrinks the file rather than re-encoding it losslessly.
// ---------------------------------------------------------------------------

/** Maps the user’s quality percent to a JPEG quality.
 *  100% → 0.85 (high quality recompress), 50% → 0.45, 1% → 0.06. */
const percentToJpegQuality = (qualityPct: number): number => {
  const q = Math.max(1, Math.min(100, qualityPct))
  return Math.max(0.05, Math.min(0.85, 0.05 + (q / 100) * 0.80))
}

/** Render scale (relative to native page resolution) at the given quality.
 *  Lowering resolution is what makes text-heavy PDFs shrink. */
const percentToRenderScale = (qualityPct: number): number => {
  const q = Math.max(1, Math.min(100, qualityPct))
  if (q >= 80) return 1
  if (q >= 60) return 0.9
  if (q >= 40) return 0.8
  if (q >= 20) return 0.65
  return 0.5
}

const targetBytesPdf = (size: number, unit: string): number => {
  const n = Math.max(1, Number(size) || 0)
  return unit === 'MB' ? Math.round(n * 1024 * 1024) : Math.round(n * 1024)
}

const loadImageFromBlob = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Could not decode image.')) }
    img.src = URL.createObjectURL(blob)
  })

/** Renders a single pdfjs page to a JPEG blob. One encode per page. */
const renderPageToJpegBlob = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  scale: number,
  quality: number,
): Promise<{ width: number; height: number; blob: Blob }> => {
  const viewport = page.getViewport({ scale })
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

/** Renders every page of a pdfjs document at the given scale and JPEG quality. */
const renderAllPages = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: any,
  scale: number,
  quality: number,
  onProgress?: (pct: number, msg: string) => void,
): Promise<Array<{ width: number; height: number; blob: Blob }>> => {
  const pages: Array<{ width: number; height: number; blob: Blob }> = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    onProgress?.(
      Math.round((i / pdf.numPages) * 90),
      `Rendering page ${i}/${pdf.numPages} at ${Math.round(scale * 100)}% scale`,
    )
    const page = await pdf.getPage(i)
    pages.push(await renderPageToJpegBlob(page, scale, quality))
  }
  return pages
}

/** Embeds the already-encoded JPEG pages into a new PDF. No second canvas
 *  re-encode - we just feed the bytes from renderPageToJpegBlob straight
 *  into pdf-lib. */
const buildPdfFromJpegPages = async (
  pages: Array<{ width: number; height: number; blob: Blob }>,
): Promise<Blob> => {
  const doc = await PDFDocument.create()
  for (const { blob } of pages) {
    const imgBytes = new Uint8Array(await blob.arrayBuffer())
    const embedded = await doc.embedJpg(imgBytes)
    const page = doc.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  }
  const bytes = await doc.save({ useObjectStreams: true })
  return new Blob([bytes.slice()], { type: 'application/pdf' })
}

/** Re-encodes a set of already-rendered JPEG pages at a different quality
 *  to estimate the size the resulting PDF would have. Used by the
 *  targetSize mode’s binary search. */
const estimatePdfSizeAtQuality = async (
  pages: Array<{ width: number; height: number; blob: Blob }>,
  quality: number,
): Promise<number> => {
  const doc = await PDFDocument.create()
  for (const { blob } of pages) {
    const img = await loadImageFromBlob(blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    const jpg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!jpg) continue
    const imgBytes = new Uint8Array(await jpg.arrayBuffer())
    const embedded = await doc.embedJpg(imgBytes)
    doc.addPage([embedded.width, embedded.height])
  }
  const saved = await doc.save({ useObjectStreams: true })
  return saved.byteLength
}

/** Compresses the PDF at a single quality+scale setting. */
const compressPdfOnce = async (
  file: ToolFile,
  qualityPct: number,
  onProgress?: (pct: number, msg: string) => void,
): Promise<Blob> => {
  const pdfjsLib = await import('pdfjs-dist')
  const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default as string
  const data = new Uint8Array(await file.blob.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const jpegQ = percentToJpegQuality(qualityPct)
  const scale = percentToRenderScale(qualityPct)
  const pages = await renderAllPages(pdf, scale, jpegQ, onProgress)
  return buildPdfFromJpegPages(pages)
}

/** Find the quality level that brings the output under the target size.
 *  Strategy: render at scale=1 quality=0.85 once, then binary-search the
 *  best quality between 0.05 and 0.85 that fits the target. If we still
 *  can’t reach the target, drop the render scale. */
const compressPdfToTarget = async (
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
  const refPages = await renderAllPages(pdf, 1, 0.85, onProgress)

  const refBlob = await buildPdfFromJpegPages(refPages)
  if (refBlob.size <= target) {
    onProgress?.(60, 'Already under target size')
    return refBlob
  }

  // First pass: binary search the JPEG quality at scale=1.
  let low = 0.05
  let high = 0.85
  let best = { quality: 0.5, size: refBlob.size }
  for (let iter = 0; iter < 6; iter += 1) {
    const q = (low + high) / 2
    onProgress?.(40 + Math.round((iter / 6) * 25), `Quality ${Math.round(q * 100)}%...`)
    const size = await estimatePdfSizeAtQuality(refPages, q)
    if (size < best.size) best = { quality: q, size }
    if (size <= target) low = q
    else high = q
  }
  if (best.size <= target) {
    onProgress?.(85, 'Building final PDF')
    return buildPdfFromJpegPages(await renderAllPages(pdf, 1, best.quality, onProgress))
  }

  // Second pass: drop the render scale (re-render at lower resolution).
  onProgress?.(70, 'Trying lower resolution')
  const scales = [0.85, 0.7, 0.6, 0.5]
  let bestOverall = { scale: 1, quality: best.quality, size: best.size, refPages: refPages as Array<{ width: number; height: number; blob: Blob }> }
  for (const s of scales) {
    onProgress?.(75 + Math.round((s === 0.5 ? 1 : 0) * 20), `Re-rendering at ${Math.round(s * 100)}% scale`)
    const lowResPages = await renderAllPages(pdf, s, 0.7, onProgress)
    const size = await estimatePdfSizeAtQuality(lowResPages, 0.7)
    if (size < bestOverall.size) {
      bestOverall = { scale: s, quality: 0.7, size, refPages: lowResPages }
    }
    if (size <= target) {
      onProgress?.(90, 'Building final PDF')
      return buildPdfFromJpegPages(lowResPages)
    }
  }

  onProgress?.(90, 'Building final PDF')
  return buildPdfFromJpegPages(bestOverall.refPages)
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
      if (file.blob.size <= target) {
        onProgress?.(Math.round((i / pdfs.length) * 95) + 5, "Source already under target - keeping original")
        blob = file.blob
      } else {
        blob = await compressPdfToTarget(file, target, (p, m) => {
          const base = Math.round((i / pdfs.length) * 90) + 5
          onProgress?.(base + Math.round(p * 0.1), m)
        })
        if (blob.size > file.blob.size) blob = file.blob
      }
    } else {
      blob = await compressPdfOnce(file, qualityPct, (p, m) => {
        const base = Math.round((i / pdfs.length) * 90) + 5
        onProgress?.(base + Math.round(p * 0.1), m)
      })
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
// ---------------------------------------------------------------------------
// PDF Watermark
//   Stamps an optional logo image and/or text onto every page. The watermark
//   is drawn as real PDF content (embedded image + text with an ExtGState
//   opacity), so the original text stays selectable and the file stays small.
// ---------------------------------------------------------------------------
const FONT_TO_STANDARD: Record<string, StandardFonts> = {
  Arial: StandardFonts.Helvetica,
  Verdana: StandardFonts.Helvetica,
  Tahoma: StandardFonts.Helvetica,
  'Trebuchet MS': StandardFonts.Helvetica,
  Impact: StandardFonts.HelveticaBold,
  Georgia: StandardFonts.TimesRoman,
  'Times New Roman': StandardFonts.TimesRoman,
  'Courier New': StandardFonts.Courier,
  'Comic Sans MS': StandardFonts.Helvetica,
  'Palatino Linotype': StandardFonts.TimesRoman,
}

/** Positions a drawW x drawH box on a page. PDF origin is bottom-left, y grows up. */
const resolvePdfAnchor = (
  position: string,
  pageW: number,
  pageH: number,
  drawW: number,
  drawH: number,
): { x: number; y: number } => {
  const margin = Math.round(Math.min(pageW, pageH) * 0.03)
  switch (position) {
    case 'top-left':
      return { x: margin, y: pageH - drawH - margin }
    case 'top-right':
      return { x: pageW - drawW - margin, y: pageH - drawH - margin }
    case 'bottom-left':
      return { x: margin, y: margin }
    case 'center':
      return { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2 }
    case 'top':
      return { x: (pageW - drawW) / 2, y: pageH - drawH - margin }
    case 'bottom':
      return { x: (pageW - drawW) / 2, y: margin }
    case 'left':
      return { x: margin, y: (pageH - drawH) / 2 }
    case 'right':
      return { x: pageW - drawW - margin, y: (pageH - drawH) / 2 }
    case 'bottom-right':
    default:
      return { x: pageW - drawW - margin, y: margin }
  }
}

const hexToRgbFloats = (hex: string): { r: number; g: number; b: number } => {
  const raw = String(hex || '').replace(/^#/, '').trim()
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return { r: 1, g: 1, b: 1 }
  const expanded = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  }
}

const embedWatermarkImage = async (doc: PDFDocument, blob: Blob): Promise<PDFImage> => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isJpg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (isPng) return doc.embedPng(bytes)
  if (isJpg) return doc.embedJpg(bytes)
  // Any other format (WebP, GIF, BMP, ...) -> re-encode to PNG on a canvas.
  const image = await loadImage(blob)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not decode the watermark image.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0)
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!png) throw new Error('Could not encode the watermark image.')
  return doc.embedPng(new Uint8Array(await png.arrayBuffer()))
}

export const pdfWatermark = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const overlays = files.filter((f) => f.name === 'watermark')
  const text = stringParam(params, 'text', '').trim()
  const hasImage = overlays.length > 0
  if (!hasImage && !text) throw new Error('Provide a watermark image and/or some text.')

  const position = stringParam(params, 'position', 'bottom-right')
  const opacity = Math.max(0.01, Math.min(1, numberParam(params, 'opacity', 100) / 100))
  const scale = Math.max(0.05, numberParam(params, 'scale', 30) / 100)
  const fontSize = Math.max(4, numberParam(params, 'fontSize', 36))

  onProgress?.(10, 'Loading PDF...')
  const doc = await loadPdf(file.blob)
  const total = doc.getPageCount()

  let watermarkImage: PDFImage | null = null
  if (hasImage) {
    onProgress?.(25, 'Embedding watermark image...')
    watermarkImage = await embedWatermarkImage(doc, overlays[0].blob)
  }

  let font: PDFFont | null = null
  if (text) {
    const fontName = stringParam(params, 'font', 'Arial')
    font = await doc.embedFont(FONT_TO_STANDARD[fontName] ?? StandardFonts.Helvetica)
  }
  const color = hexToRgbFloats(stringParam(params, 'color', '#FFFFFF'))

  for (let i = 0; i < total; i += 1) {
    onProgress?.(Math.round((i / total) * 65) + 25, `Watermarking page ${i + 1}/${total}...`)
    const page = doc.getPage(i)
    const { width: pageW, height: pageH } = page.getSize()

    if (watermarkImage) {
      const drawW = Math.max(1, pageW * scale)
      const drawH = Math.max(1, drawW * (watermarkImage.height / watermarkImage.width))
      const pos = resolvePdfAnchor(position, pageW, pageH, drawW, drawH)
      page.drawImage(watermarkImage, { x: pos.x, y: pos.y, width: drawW, height: drawH, opacity })
    }

    if (text && font) {
      const blockW = font.widthOfTextAtSize(text, fontSize)
      const blockH = fontSize
      const pos = resolvePdfAnchor(position, pageW, pageH, blockW, blockH)
      // Baseline sits slightly inside the block so the visible glyph box
      // matches the anchor exactly (approx 20% descender / 80% ascender).
      page.drawText(text, {
        x: pos.x,
        y: pos.y + fontSize * 0.2,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity: Math.max(0.05, opacity),
      })
    }
  }

  onProgress?.(95, 'Saving...')
  const blob = await savePdf(doc)
  onProgress?.(100, 'Done.')
  return [{ name: 'watermarked.pdf', blob }]
}
// ---------------------------------------------------------------------------
// Protect PDF - encrypts the file with a password (AES-256 or RC4) and
//   optional permission restrictions. Runs entirely client-side using the
//   @pdfsmaller/pdf-encrypt engine (built on pdf-lib + Web Crypto).
// ---------------------------------------------------------------------------
interface PdfProtectPermissions {
  allowPrinting: boolean
  allowModifying: boolean
  allowCopying: boolean
  allowAnnotating: boolean
  allowFillingForms: boolean
  allowExtraction: boolean
  allowAssembly: boolean
  allowHighQualityPrint: boolean
}

const permissionPresets: Record<string, PdfProtectPermissions> = {
  'no restrictions': {
    allowPrinting: true,
    allowModifying: true,
    allowCopying: true,
    allowAnnotating: true,
    allowFillingForms: true,
    allowExtraction: true,
    allowAssembly: true,
    allowHighQualityPrint: true,
  },
  'prevent printing': {
    allowPrinting: false,
    allowModifying: true,
    allowCopying: true,
    allowAnnotating: true,
    allowFillingForms: true,
    allowExtraction: true,
    allowAssembly: true,
    allowHighQualityPrint: false,
  },
  'view only': {
    allowPrinting: false,
    allowModifying: false,
    allowCopying: false,
    allowAnnotating: false,
    allowFillingForms: false,
    allowExtraction: true,
    allowAssembly: false,
    allowHighQualityPrint: false,
  },
}

export const pdfProtect = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const password = stringParam(params, 'password', '')
  if (!password) throw new Error('Provide a password to protect the PDF.')
  const ownerPassword = stringParam(params, 'ownerPassword', '') || password
  const algorithm = stringParam(params, 'algorithm', 'AES-256') === 'RC4' ? 'RC4' : 'AES-256'
  const permissions = permissionPresets[stringParam(params, 'restrictions', 'no restrictions')] ?? permissionPresets['no restrictions']

  onProgress?.(10, 'Reading PDF...')
  const bytes = new Uint8Array(await file.blob.arrayBuffer())

  const { isEncrypted } = await import('@pdfsmaller/pdf-decrypt')
  let alreadyProtected = false
  try {
    alreadyProtected = (await isEncrypted(bytes)).encrypted
  } catch {
    throw new Error('Not a valid PDF file.')
  }
  if (alreadyProtected) {
    throw new Error('This PDF is already password-protected. Unlock it first if you want to apply a different password.')
  }

  onProgress?.(25, 'Encrypting...')
  const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt')
  let encrypted: Uint8Array
  try {
    encrypted = await encryptPDF(bytes, password, { ownerPassword, algorithm, ...permissions })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('already encrypted')) throw new Error('This PDF is already password-protected.')
    if (message.includes('password')) throw new Error(`The password could not be stored for ${algorithm} encryption: ${message}`)
    throw new Error(`Could not protect the PDF: ${message || 'unknown error'}`)
  }

  onProgress?.(90, 'Saving...')
  const blob = new Blob([encrypted.slice(0)], { type: 'application/pdf' })
  onProgress?.(100, 'Done.')
  return [{ name: 'protected.pdf', blob }]
}
// ---------------------------------------------------------------------------
// Unlock PDF - removes password protection.
//   Primary path uses @pdfsmaller/pdf-decrypt (AES-256 / RC4, content-
//   preserving). If the lock uses a legacy algorithm it cannot handle
//   (e.g. AES-128 / R4), a pdf.js fallback re-renders the pages and rebuilds
//   an unencrypted PDF instead.
// ---------------------------------------------------------------------------
const unlockViaRendering = async (
  bytes: Uint8Array,
  password: string,
  onProgress?: Progress,
): Promise<ToolOutput[]> => {
  onProgress?.(20, 'Rendering pages (legacy encryption)...')
  const pdfjsLib = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default as string

  let pdf: unknown
  try {
    pdf = await pdfjsLib.getDocument({ data: bytes, password: password || undefined }).promise
  } catch (error) {
    const err = error as { name?: string }
    if (err?.name === 'PasswordException') {
      throw new Error(
        password
          ? 'Incorrect password — please check it and try again.'
          : 'This PDF is password-protected. Enter the password above to unlock it.',
      )
    }
    throw new Error('Not a valid PDF file.')
  }

  const doc = await PDFDocument.create()
  const scale = 1.5
  for (let i = 1; i <= (pdf as { numPages: number }).numPages; i += 1) {
    onProgress?.(Math.round((i / (pdf as { numPages: number }).numPages) * 70) + 20, `Rendering page ${i}/${(pdf as { numPages: number }).numPages}...`)
    const page = await (pdf as { getPage: (n: number) => Promise<unknown> }).getPage(i)
    const pageData = page as {
      getViewport: (opts: { scale: number }) => { width: number; height: number }
      render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<unknown> }
    }
    const viewport = pageData.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas context.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await pageData.render({ canvasContext: ctx, viewport, canvas }).promise
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!jpeg) throw new Error('Could not encode the rendered page.')
    const embedded = await doc.embedJpg(new Uint8Array(await jpeg.arrayBuffer()))
    // Keep the original page size in points; the render simply fills it.
    const outPage = doc.addPage([viewport.width / scale, viewport.height / scale])
    outPage.drawImage(embedded, { x: 0, y: 0, width: viewport.width / scale, height: viewport.height / scale })
  }

  onProgress?.(95, 'Saving...')
  const blob = await savePdf(doc)
  onProgress?.(100, 'Done.')
  return [{ name: 'unlocked.pdf', blob }]
}

export const pdfUnlock = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'pdf')
  const password = stringParam(params, 'password', '')
  const bytes = new Uint8Array(await file.blob.arrayBuffer())

  onProgress?.(10, 'Reading PDF...')
  const { decryptPDF, isEncrypted } = await import('@pdfsmaller/pdf-decrypt')
  let info: { encrypted: boolean }
  try {
    info = await isEncrypted(bytes)
  } catch {
    throw new Error('Not a valid PDF file.')
  }
  if (!info.encrypted) {
    onProgress?.(100, 'Done - this PDF is not protected.')
    return [{ name: 'unlocked.pdf', blob: file.blob }]
  }

  try {
    onProgress?.(25, 'Unlocking...')
    const decrypted = await decryptPDF(bytes, password)
    onProgress?.(90, 'Saving...')
    const blob = new Blob([decrypted.slice(0)], { type: 'application/pdf' })
    onProgress?.(100, 'Done.')
    return [{ name: 'unlocked.pdf', blob }]
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('not encrypted')) {
      onProgress?.(100, 'Done - this PDF is not protected.')
      return [{ name: 'unlocked.pdf', blob: file.blob }]
    }
    if (message.includes('Incorrect password')) {
      throw new Error(
        password
          ? 'Incorrect password — please check it and try again.'
          : 'This PDF is password-protected. Enter the password above to unlock it.',
      )
    }
    if (message.includes('Unsupported encryption')) {
      return unlockViaRendering(bytes, password, onProgress)
    }
    throw new Error(`Could not unlock the PDF: ${message || 'unknown error'}`)
  }
}
