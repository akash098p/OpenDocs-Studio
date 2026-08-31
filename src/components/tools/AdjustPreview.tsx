import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import { loadImage } from '@/tools/helpers'
import { renderAdjustments } from '@/tools/imageProcessors'
import { ToolParams } from '@/tools/types'

interface AdjustPreviewProps {
  file: File
  values: ToolParams
}

// Longest edge of the preview render — keeps re-renders fast on large photos.
const PREVIEW_MAX = 1000
// Debounce so dragging a slider doesn't queue up a render for every step.
const DEBOUNCE_MS = 150

// Live preview for the Adjustments & Enhancement tool: re-renders the picked
// image through the exact same pipeline as the export whenever a field changes,
// with a toggle to peek at the untouched original.
export const AdjustPreview: React.FC<AdjustPreviewProps> = ({ file, values }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [busy, setBusy] = useState(false)

  // Decode the picked image once and keep a downscaled, untouched copy to render from.
  useEffect(() => {
    let cancelled = false
    setReady(false)
    setShowOriginal(false)
    loadImage(file)
      .then((image) => {
        if (cancelled) return
        const scale = Math.min(1, PREVIEW_MAX / Math.max(image.naturalWidth, image.naturalHeight))
        const base = document.createElement('canvas')
        base.width = Math.max(1, Math.round(image.naturalWidth * scale))
        base.height = Math.max(1, Math.round(image.naturalHeight * scale))
        base.getContext('2d')?.drawImage(image, 0, 0, base.width, base.height)
        baseRef.current = base
        setReady(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [file])

  // Re-render on every field change (debounced), always starting from the untouched
  // base canvas so adjustments never stack between renders.
  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    const base = baseRef.current
    if (!canvas || !base) return
    setBusy(true)
    const timer = window.setTimeout(() => {
      const rendered = showOriginal ? base : renderAdjustments(base, values)
      canvas.width = rendered.width
      canvas.height = rendered.height
      canvas.getContext('2d')?.drawImage(rendered, 0, 0)
      setBusy(false)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [ready, showOriginal, values])

  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm p-3 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Live preview</p>
        <div className="flex items-center gap-3">
          {busy && <span className="text-xs text-slate-400 dark:text-slate-500">updating…</span>}
          <Button variant="ghost" size="sm" type="button" onClick={() => setShowOriginal((current) => !current)}>
            {showOriginal ? 'Show adjusted' : 'Compare original'}
          </Button>
        </div>
      </div>
      <div
        className="flex max-h-[440px] items-center justify-center overflow-hidden rounded-md border border-slate-200 p-2 dark:border-slate-700"
        style={{ backgroundImage: 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)', backgroundSize: '16px 16px' }}
      >
        <canvas ref={canvasRef} className="h-auto max-h-[420px] w-auto max-w-full" />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {showOriginal
          ? 'Showing the untouched original — click "Show adjusted" to go back.'
          : 'The preview updates as you change the settings and shows the first image at reduced size. Happy with the look? Run Tool to export it at full quality.'}
      </p>
    </div>
  )
}