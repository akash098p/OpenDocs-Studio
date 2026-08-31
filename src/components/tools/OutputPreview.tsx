import React, { useState, useEffect, useRef } from 'react'
import { ToolOutput } from '@/tools/types'
import { downloadBlob, makeZip, fileExtension } from '@/tools/helpers'
import { formatFileSize } from '@utils/helpers'
import { Button } from '@components/ui/Button'

interface OutputPreviewProps {
  outputs: ToolOutput[]
  onClear: () => void
}

let pdfjsWorkerSet = false

const FileIcon: React.FC = () => (
  <div className="flex h-24 w-full items-center justify-center text-slate-400">
    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5.291A10.014 10.014 0 0112 22l-10-3v-7l10-5 10 5v7l-10 3a10.014 10.014 0 01-7-2.709" />
    </svg>
  </div>
)


const ImagePreview: React.FC<{ blob: Blob }> = ({ blob }) => {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  if (!url) return null
  return <img src={url} alt="Output" className="max-h-48 max-w-full rounded object-contain" />
}

const PDFThumbnail: React.FC<{ blob: Blob }> = ({ blob }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const renderPdf = async () => {
      try {
        if (!pdfjsWorkerSet) {
          const pdfjsLib = await import('pdfjs-dist')
          const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
          pdfjsLib.GlobalWorkerOptions.workerSrc = (worker as unknown as { default: string }).default
          pdfjsWorkerSet = true
        }
        const pdfjsLib = await import('pdfjs-dist')
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
        if (cancelled) return
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 0.5 })
        const canvas = canvasRef.current
        if (!canvas || !canvas.getContext('2d')) {
          setError(true); setLoading(false); return
        }
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        if (cancelled) return; setLoading(false)
      } catch {
        if (cancelled) return; setError(true); setLoading(false)
      }
    }
    renderPdf()
    return () => { cancelled = true }
  }, [blob])

  if (loading) return <div className="flex h-24 items-center justify-center text-sm text-slate-500">Loading PDF…</div>
  if (error) return <FileIcon />
  return <canvas ref={canvasRef} className="max-w-full rounded" />
}

const renderPreview = (output: ToolOutput): React.ReactNode => {
  const ext = fileExtension(output.name)
  const isImage = output.blob.type.startsWith('image/') && output.blob.type !== 'image/x-icon'
  const isPdf = ext === 'pdf' || output.blob.type === 'application/pdf'
  if (isImage) return <ImagePreview blob={output.blob} />
  if (isPdf) return <PDFThumbnail blob={output.blob} />
  return <FileIcon />
}

export const OutputPreview: React.FC<OutputPreviewProps> = ({ outputs, onClear }) => {
  const handleDownload = (output: ToolOutput) => downloadBlob(output.blob, output.name)
  const handleDownloadAll = async () => {
    if (outputs.length <= 1) return
    const zip = await makeZip(outputs)
    downloadBlob(zip, 'tool-output.zip')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Output ({outputs.length} file{outputs.length !== 1 ? 's' : ''})
        </h3>
        <div className="flex gap-2">
          {outputs.length > 1 && (
            <Button size="sm" variant="secondary" onClick={handleDownloadAll}>
              Download All as ZIP
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear &amp; Run Again
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {outputs.map((output, index) => (
          <div
            key={`${output.name}-${index}`}
            className="rounded-lg border border-slate-200 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-4 dark:border-slate-700"
          >
            <div className="mb-3 flex justify-center overflow-hidden">
              {renderPreview(output)}
            </div>
            <div className="space-y-2 text-center">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                {output.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(output.blob.size)}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => handleDownload(output)}
              >
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


