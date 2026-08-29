import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@components/ui/Button'
import { loadImage } from '@/tools/helpers'
import { VisualEditorHandle } from '@/tools/types'

export type ImageEditorHandle = VisualEditorHandle

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

type DragHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

interface ImageEditorProps {
  file: File
}

const MIN_CROP_SIZE_PCT = 5
const FULL_CROP: CropRect = { x: 0, y: 0, width: 100, height: 100 }

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const HANDLE_STYLES: Record<DragHandle, string> = {
  move: '',
  nw: '-left-2 -top-2 cursor-nwse-resize',
  n: 'left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-2 -top-2 cursor-nesw-resize',
  e: '-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-right-2 -bottom-2 cursor-nwse-resize',
  s: 'left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize',
  sw: '-left-2 -bottom-2 cursor-nesw-resize',
  w: '-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize',
}

const HANDLE_ORDER: DragHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const ImageEditor = forwardRef<ImageEditorHandle, ImageEditorProps>(({ file }, ref) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [rotCanvas, setRotCanvas] = useState<HTMLCanvasElement | null>(null)
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropRect>(FULL_CROP)
  const [rotate, setRotate] = useState(0)

  const frameRef = useRef<HTMLDivElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<{
    handle: DragHandle
    startX: number
    startY: number
    startCrop: CropRect
    rect: DOMRect
  } | null>(null)

  // ---------------------------------------------------------------------------
  // Load the image whenever a new file is selected; reset the editor state
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setImage(null)
    setRotCanvas(null)
    setDisplayImageUrl(null)
    setCrop(FULL_CROP)
    setRotate(0)
    loadImage(file)
      .then((img) => {
        if (!cancelled) setImage(img)
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })
    return () => {
      cancelled = true
    }
  }, [file])

  // ---------------------------------------------------------------------------
  // Build the rotated canvas — the source of truth for display and preview
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!image) return
    const swapped = rotate === 90 || rotate === 270
    const w = swapped ? image.naturalHeight : image.naturalWidth
    const h = swapped ? image.naturalWidth : image.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate((rotate * Math.PI) / 180)
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    ctx.restore()
    setRotCanvas(canvas)
  }, [image, rotate])

  // ---------------------------------------------------------------------------
  // Display the rotated canvas as an image URL for the crop workspace
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rotCanvas) return
    let url: string | null = null
    let cancelled = false
    if (rotate === 0) {
      url = URL.createObjectURL(file)
      setDisplayImageUrl(url)
    } else {
      rotCanvas.toBlob((blob) => {
        if (!blob || cancelled) return
        url = URL.createObjectURL(blob)
        setDisplayImageUrl(url)
      }, 'image/png')
    }
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [rotCanvas, rotate, file])

  // ---------------------------------------------------------------------------
  // Live preview canvas — shows exactly what the cropped output will be
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas || !rotCanvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const previewSize = 180
    canvas.width = previewSize
    canvas.height = previewSize
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, previewSize, previewSize)
    const sx = (crop.x / 100) * rotCanvas.width
    const sy = (crop.y / 100) * rotCanvas.height
    const sw = Math.max(1, (crop.width / 100) * rotCanvas.width)
    const sh = Math.max(1, (crop.height / 100) * rotCanvas.height)
    const scale = Math.min((previewSize * 0.9) / sw, (previewSize * 0.9) / sh)
    const dw = sw * scale
    const dh = sh * scale
    ctx.drawImage(rotCanvas, sx, sy, sw, sh, (previewSize - dw) / 2, (previewSize - dh) / 2, dw, dh)
  }, [crop, rotCanvas])

  // ---------------------------------------------------------------------------
  // Crop-box dragging: move the box or resize it via 8 handles
  // ---------------------------------------------------------------------------
  const applyDrag = useCallback((event: PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag) return
    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100
    const start = drag.startCrop
    const min = MIN_CROP_SIZE_PCT
    let { x, y, width, height } = start

    switch (drag.handle) {
      case 'move':
        x = clamp(start.x + dx, 0, 100 - start.width)
        y = clamp(start.y + dy, 0, 100 - start.height)
        break
      case 'e':
        width = clamp(start.width + dx, min, 100 - start.x)
        break
      case 'w':
        x = clamp(start.x + dx, 0, start.x + start.width - min)
        width = start.x + start.width - x
        break
      case 's':
        height = clamp(start.height + dy, min, 100 - start.y)
        break
      case 'n':
        y = clamp(start.y + dy, 0, start.y + start.height - min)
        height = start.y + start.height - y
        break
      case 'se':
        width = clamp(start.width + dx, min, 100 - start.x)
        height = clamp(start.height + dy, min, 100 - start.y)
        break
      case 'ne':
        width = clamp(start.width + dx, min, 100 - start.x)
        y = clamp(start.y + dy, 0, start.y + start.height - min)
        height = start.y + start.height - y
        break
      case 'sw':
        x = clamp(start.x + dx, 0, start.x + start.width - min)
        height = clamp(start.height + dy, min, 100 - start.y)
        width = start.x + start.width - x
        break
      case 'nw':
        x = clamp(start.x + dx, 0, start.x + start.width - min)
        y = clamp(start.y + dy, 0, start.y + start.height - min)
        width = start.x + start.width - x
        height = start.y + start.height - y
        break
    }
    setCrop({ x, y, width, height })
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

  const startDrag = (handle: DragHandle) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const frame = frameRef.current
    if (!frame) return
    dragStateRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: { ...crop },
      rect: frame.getBoundingClientRect(),
    }
    window.addEventListener('pointermove', applyDrag)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
  }

  const rotateLeft = () => setRotate((value) => (value + 270) % 360)
  const rotateRight = () => setRotate((value) => (value + 90) % 360)
  const resetEditor = () => {
    setRotate(0)
    setCrop(FULL_CROP)
  }

  // Expose the current editor values so ToolRunner can send them to the processor.
  useImperativeHandle(ref, () => ({
    getParams: () => ({
      cropX: String(Math.round(crop.x * 100) / 100),
      cropY: String(Math.round(crop.y * 100) / 100),
      cropWidth: String(Math.round(crop.width * 100) / 100),
      cropHeight: String(Math.round(crop.height * 100) / 100),
      rotate: String(rotate),
    }),
  }))

  const outWidth = rotCanvas ? Math.round((crop.width / 100) * rotCanvas.width) : 0
  const outHeight = rotCanvas ? Math.round((crop.height / 100) * rotCanvas.height) : 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Crop &amp; rotate editor</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={rotateLeft}>
            ↺ Rotate left
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={rotateRight}>
            ↻ Rotate right
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={resetEditor}>
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1 overflow-auto rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
          {displayImageUrl ? (
            <div ref={frameRef} className="relative inline-block max-w-full select-none touch-none">
              <img src={displayImageUrl} alt="Editing preview" draggable={false} className="block max-h-[420px] max-w-full rounded" />
              {/* Dim everything outside the crop box */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 top-0 w-full bg-slate-950/50" style={{ height: `${crop.y}%` }} />
                <div
                  className="absolute left-0 w-full bg-slate-950/50"
                  style={{ top: `${crop.y + crop.height}%`, height: `${100 - crop.y - crop.height}%` }}
                />
                <div
                  className="absolute left-0 bg-slate-950/50"
                  style={{ top: `${crop.y}%`, height: `${crop.height}%`, width: `${crop.x}%` }}
                />
                <div
                  className="absolute bg-slate-950/50"
                  style={{
                    top: `${crop.y}%`,
                    height: `${crop.height}%`,
                    left: `${crop.x + crop.width}%`,
                    width: `${100 - crop.x - crop.width}%`,
                  }}
                />
              </div>
              {/* Movable / resizable crop box */}
              <div
                className="absolute cursor-move border-2 border-primary-500"
                style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
                onPointerDown={startDrag('move')}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
                  <div className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
                </div>
                {HANDLE_ORDER.map((handle) => (
                  <div
                    key={handle}
                    onPointerDown={startDrag(handle)}
                    className={`absolute h-4 w-4 rounded-full border-2 border-white bg-primary-600 shadow ${HANDLE_STYLES[handle]}`}
                  />
                ))}
                <div className="pointer-events-none absolute -top-7 left-0 whitespace-nowrap rounded bg-slate-900/85 px-2 py-0.5 text-xs text-white">
                  {Math.round(crop.width)}% × {Math.round(crop.height)}%
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500 dark:text-slate-400">Loading image…</div>
          )}
        </div>

        <div className="w-full shrink-0 lg:w-52">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Live preview</p>
          <canvas ref={previewCanvasRef} className="w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700" />
          <dl className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex justify-between">
              <dt>Output size</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">
                {outWidth} × {outHeight} px
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Rotation</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{rotate}°</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Drag inside the box to move it — drag a corner or edge handle to resize it.
      </p>
    </div>
  )
})

ImageEditor.displayName = 'ImageEditor'
