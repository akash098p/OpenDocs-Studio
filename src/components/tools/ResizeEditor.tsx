import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@components/ui/Button'
import { loadImage } from '@/tools/helpers'
import { calculateFitInside } from '@/tools/imageProcessors'
import { VisualEditorHandle } from '@/tools/types'

export type ResizeEditorHandle = VisualEditorHandle

interface ResizeEditorProps {
  file: File
}

const MIN_SIZE = 1
const MAX_SIZE = 8192
const PREVIEW_SIZE = 180

const ALGORITHMS: Array<{ value: string; label: string }> = [
  { value: 'bicubic', label: 'Bicubic — smooth' },
  { value: 'lanczos', label: 'Lanczos — sharp' },
  { value: 'bilinear', label: 'Bilinear — fast' },
  { value: 'nearest', label: 'Nearest — pixel art' },
  { value: 'area', label: 'Area — downscale' },
]

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const ResizeEditor = forwardRef<ResizeEditorHandle, ResizeEditorProps>(({ file }, ref) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [displayUrl, setDisplayUrl] = useState<string | null>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lockAspect, setLockAspect] = useState(true)
  const [fit, setFit] = useState<'stretch' | 'fit-inside'>('stretch')
  const [algo, setAlgo] = useState('bicubic')

  const frameRef = useRef<HTMLDivElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<{
    startX: number
    startY: number
    startW: number
    startH: number
    scale: number
    ratio: number
    lockAspect: boolean
  } | null>(null)

  // Load the image whenever a new file is selected
  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)
    setDisplayUrl(url)
    setImage(null)
    loadImage(file)
      .then((img) => {
        if (cancelled) return
        setImage(img)
        setWidth(img.naturalWidth)
        setHeight(img.naturalHeight)
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  const ratio = image ? image.naturalHeight / image.naturalWidth : 1

  // Size setters that respect the aspect-ratio lock
  const applyWidth = useCallback(
    (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return
      const w = clamp(Math.round(nextWidth), MIN_SIZE, MAX_SIZE)
      setWidth(w)
      if (lockAspect) setHeight(clamp(Math.round(w * ratio), MIN_SIZE, MAX_SIZE))
    },
    [lockAspect, ratio],
  )

  const applyHeight = useCallback(
    (nextHeight: number) => {
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return
      const h = clamp(Math.round(nextHeight), MIN_SIZE, MAX_SIZE)
      setHeight(h)
      if (lockAspect) setWidth(clamp(Math.round(h / ratio), MIN_SIZE, MAX_SIZE))
    },
    [lockAspect, ratio],
  )

  const toggleLock = () => {
    const next = !lockAspect
    setLockAspect(next)
    if (next && image) setHeight(clamp(Math.round(width * ratio), MIN_SIZE, MAX_SIZE))
  }

  const resetEditor = () => {
    if (image) {
      setWidth(image.naturalWidth)
      setHeight(image.naturalHeight)
    }
    setLockAspect(true)
    setAlgo('bicubic')
    setFit('stretch')
  }

  // Corner-handle dragging: drag towards / away from the image to rescale
  const applyDrag = useCallback((event: PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag) return
    const dxScreen = event.clientX - drag.startX
    const dyScreen = event.clientY - drag.startY
    if (drag.lockAspect) {
      const dominant = Math.abs(dxScreen) >= Math.abs(dyScreen) ? dxScreen : dyScreen
      const w = clamp(Math.round(drag.startW + dominant / drag.scale), MIN_SIZE, MAX_SIZE)
      setWidth(w)
      setHeight(clamp(Math.round(w * drag.ratio), MIN_SIZE, MAX_SIZE))
    } else {
      setWidth(clamp(Math.round(drag.startW + dxScreen / drag.scale), MIN_SIZE, MAX_SIZE))
      setHeight(clamp(Math.round(drag.startH + dyScreen / drag.scale), MIN_SIZE, MAX_SIZE))
    }
  }, [])

  const endDrag = useCallback(() => {
    dragStateRef.current = null
    window.removeEventListener('pointermove', applyDrag)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
  }, [applyDrag])

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', applyDrag)
      window.removeEventListener('pointercancel', endDrag)
    },
    [applyDrag, endDrag],
  )

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const frame = frameRef.current
    if (!frame || !image || width <= 0) return
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startW: width,
      startH: height,
      scale: frame.getBoundingClientRect().width / width,
      ratio,
      lockAspect,
    }
    window.addEventListener('pointermove', applyDrag)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
  }


  // Output dimensions: exact box for stretch, fitted (aspect kept) for fit-inside
  const output =
    image && width > 0 && height > 0
      ? fit === 'fit-inside'
        ? calculateFitInside(image.naturalWidth, image.naturalHeight, width, height)
        : { width, height }
      : { width: 0, height: 0 }

  // Live preview canvas — shows the scaled result, including stretch distortion
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas || !image || output.width <= 0 || output.height <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = PREVIEW_SIZE
    canvas.height = PREVIEW_SIZE
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    ctx.imageSmoothingEnabled = algo !== 'nearest'
    ctx.imageSmoothingQuality = 'high'
    const scale = Math.min((PREVIEW_SIZE * 0.9) / output.width, (PREVIEW_SIZE * 0.9) / output.height)
    const dw = output.width * scale
    const dh = output.height * scale
    ctx.drawImage(image, (PREVIEW_SIZE - dw) / 2, (PREVIEW_SIZE - dh) / 2, dw, dh)
  }, [image, output.width, output.height, algo])

  // Expose the current editor values so ToolRunner can send them to the processor.
  useImperativeHandle(ref, () => ({
    getParams: () => ({
      width: String(width),
      height: String(height),
      fit,
      algo,
    }),
  }))

  const scalePct =
    image && image.naturalWidth > 0 && output.width > 0
      ? Math.round((output.width / image.naturalWidth) * 100)
      : 100

  return (
    <div className="space-y-4">
      {/* Editing workspace: original image with draggable output frame */}
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">
            Original — drag the corner handle to rescale (output overlay shown in dashed blue)
          </p>
          <div
            ref={frameRef}
            className="relative mx-auto max-w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 select-none"
          >
            {displayUrl && (
              <img src={displayUrl} alt="Original" className="block h-auto max-h-96 w-auto max-w-full" draggable={false} />
            )}
            {image && width > 0 && (
              <div
                className="absolute cursor-nwse-resize border-2 border-dashed border-blue-500/90 bg-blue-400/10"
                style={{
                  left: '50%',
                  top: '50%',
                  width: `${Math.min(100, (width / image.naturalWidth) * 100)}%`,
                  height: `${Math.min(100, (height / image.naturalHeight) * 100)}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onPointerDown={startDrag}
              >
                <span className="absolute -bottom-6 left-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {width} × {height}
                </span>
                <span className="absolute right-0 bottom-0 h-4 w-4 rounded-tl bg-blue-600 shadow" />
              </div>
            )}
          </div>
        </div>

        {/* Live preview + readouts */}
        <div className="w-full space-y-2 lg:w-56">
          <p className="text-xs font-medium text-slate-500">Live preview</p>
          <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2">
            <canvas ref={previewCanvasRef} className="max-w-full rounded" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            {fit === 'fit-inside' && (
              <div className="flex justify-between">
                <span>Box</span>
                <span className="font-semibold text-slate-800">
                  {width} × {height} px
                </span>
              </div>
            )}
            <div className={`flex justify-between${fit === 'fit-inside' ? ' mt-1' : ''}`}>
              <span>Output</span>
              <span className="font-semibold text-slate-800">
                {output.width} × {output.height} px
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Scale</span>
              <span className="font-semibold text-slate-800">{scalePct}%</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={resetEditor} disabled={!image}>
            Reset
          </Button>
        </div>
      </div>

      {/* Exact values + algorithm + aspect lock */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Width (px)</span>
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={width || ''}
            onChange={(e) => applyWidth(Number(e.target.value))}
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Height (px)</span>
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={height || ''}
            onChange={(e) => applyHeight(Number(e.target.value))}
            className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={lockAspect} onChange={toggleLock} className="h-4 w-4 accent-blue-600" />
          Lock aspect ratio
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Fit mode</span>
          <select
            value={fit}
            onChange={(e) => setFit(e.target.value as 'stretch' | 'fit-inside')}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="stretch">Exact size (stretch)</option>
            <option value="fit-inside">Fit inside box</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Algorithm</span>
          <select
            value={algo}
            onChange={(e) => setAlgo(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {ALGORITHMS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
})

ResizeEditor.displayName = 'ResizeEditor'

