import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { FC } from 'react'
import { loadImage } from '@/tools/helpers'
import { ALBUM_TEMPLATES, renderAlbum } from '@/tools/albumRenderer'
import { VisualEditorHandle } from '@/tools/types'

export type AlbumEditorHandle = VisualEditorHandle

interface AlbumEditorProps {
  files: File[]
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const NumberField: FC<{
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
}> = ({ label, value, min = 0, max = 99999, step, disabled = false, onChange }) => (
  <label className="flex flex-col gap-1">
    <span className={`text-xs font-medium ${disabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
      {label}
    </span>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n))
      }}
      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-900"
    />
  </label>
)

const ColorField: FC<{
  label: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}> = ({ label, value, disabled = false, onChange }) => (
  <label className="flex flex-col gap-1">
    <span className={`text-xs font-medium ${disabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
      {label}
    </span>
    <input
      type="color"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-900"
    />
  </label>
)

const SelectField: FC<{
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}> = ({ label, value, options, onChange }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  </label>
)

export const AlbumEditor = forwardRef<AlbumEditorHandle, AlbumEditorProps>(({ files }, ref) => {
  const [images, setImages] = useState<HTMLImageElement[]>([])
  const [template, setTemplate] = useState('classic')
  const [columns, setColumns] = useState(3)
  const [thumbW, setThumbW] = useState(480)
  const [thumbH, setThumbH] = useState(360)
  const [spacing, setSpacing] = useState(12)
  const [fit, setFit] = useState<'stretch' | 'cover'>('cover')
  const [cornerRadius, setCornerRadius] = useState(16)
  const [frameWidth, setFrameWidth] = useState(0)
  const [frameColor, setFrameColor] = useState('#FFFFFF')
  const [background, setBackground] = useState('#F1F5F9')
  const [format, setFormat] = useState('png')

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const thumbCanvasesRef = useRef<Record<string, HTMLCanvasElement | null>>({})
  const placeholderRef = useRef<HTMLImageElement[] | null>(null)
  const [thumbsReady, setThumbsReady] = useState(false)

  // Load photos whenever the file list changes
  useEffect(() => {
    let cancelled = false
    if (!files.length) {
      setImages([])
      return
    }
    Promise.all(files.map((f) => loadImage(f)))
      .then((imgs) => {
        if (!cancelled) setImages(imgs)
      })
      .catch(() => {
        if (!cancelled) setImages([])
      })
    return () => {
      cancelled = true
    }
  }, [files])

  // One-time placeholder photos for the template thumbnail cards
  useEffect(() => {
    const colors = ['#64748B', '#0EA5E9', '#F59E0B', '#10B981']
    Promise.all(
      colors.map((color) => {
        const c = document.createElement('canvas')
        c.width = 64
        c.height = 48
        const cx = c.getContext('2d')
        if (cx) {
          cx.fillStyle = color
          cx.fillRect(0, 0, 64, 48)
          cx.fillStyle = 'rgba(255, 255, 255, 0.25)'
          cx.beginPath()
          cx.arc(46, 14, 8, 0, Math.PI * 2)
          cx.fill()
        }
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.src = c.toDataURL()
        })
      }),
    ).then((imgs) => {
      placeholderRef.current = imgs
      setThumbsReady(true)
    })
  }, [])

  // Render template thumbnail cards (one-time when thumbs become ready, re-render on template change)
  useEffect(() => {
    if (!thumbsReady || !placeholderRef.current) return
    ALBUM_TEMPLATES.forEach((t) => {
      const el = thumbCanvasesRef.current[t.id]
      if (!el) return
      try {
        const rendered = renderAlbum({
          images: placeholderRef.current!,
          template: t.id,
          thumbW: 64,
          thumbH: 48,
          columns: t.id === 'strip' ? 4 : 3,
          spacing: 4,
          fit: 'cover',
          cornerRadius: t.id === 'rounded' ? 8 : 0,
          frameWidth: 0,
          frameColor: '#FFFFFF',
          background: '#1E293B',
        })
        el.width = el.offsetWidth || 96
        el.height = el.offsetHeight || 64
        const ctx = el.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, el.width, el.height)
          const scale = Math.min(el.width / rendered.width, el.height / rendered.height)
          const dw = rendered.width * scale
          const dh = rendered.height * scale
          ctx.drawImage(rendered, (el.width - dw) / 2, (el.height - dh) / 2, dw, dh)
        }
      } catch {
        // render failure is non-fatal for thumbnails
      }
    })
  }, [thumbsReady])

  // Live preview — re-renders whenever any style or image changes
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const sources = images.length > 0 ? images : (placeholderRef.current ?? [])
    if (sources.length === 0) return
    const previewSize = 1200
    const aspect = images.length > 0 ? images[0].naturalWidth / images[0].naturalHeight : 4 / 3
    canvas.width = previewSize
    canvas.height = Math.round(previewSize / aspect)
    try {
      const rendered = renderAlbum({
        images: sources,
        template,
        thumbW: thumbW,
        thumbH: thumbH,
        columns,
        spacing,
        fit,
        cornerRadius,
        frameWidth,
        frameColor,
        background,
      })
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(rendered, 0, 0, canvas.width, canvas.height)
      }
    } catch {
      // render failure is non-fatal
    }
  }, [images, template, thumbW, thumbH, columns, spacing, fit, cornerRadius, frameWidth, frameColor, background])

  useImperativeHandle(ref, () => ({
    getParams: () => ({
      template: String(template),
      thumbW: String(thumbW),
      thumbH: String(thumbH),
      columns: String(columns),
      spacing: String(spacing),
      fit: String(fit),
      cornerRadius: String(cornerRadius),
      frameWidth: String(frameWidth),
      frameColor: String(frameColor),
      background: String(background),
      format: String(format),
    }),
  }))

  const isPolaroid = template === 'polaroid'
  const isStrip = template === 'strip'


  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Templates</h3>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {ALBUM_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`flex items-center gap-3 rounded-lg border p-2 text-left transition ${
                  template === t.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 dark:border-blue-400 dark:bg-blue-900/30 dark:ring-blue-800'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                  <canvas
                    ref={(el) => {
                      thumbCanvasesRef.current[t.id] = el
                    }}
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.name}</div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Layout</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField label="Columns" value={columns} min={1} max={8} disabled={isStrip} onChange={setColumns} />
            <NumberField label="Spacing" value={spacing} min={0} max={64} onChange={setSpacing} />
            <NumberField label="Tile W" value={thumbW} min={64} max={2000} step={32} onChange={setThumbW} />
            <NumberField label="Tile H" value={thumbH} min={64} max={2000} step={32} onChange={setThumbH} />
            <SelectField
              label="Tile fit"
              value={fit}
              options={[
                ['cover', 'Cover (fill)'],
                ['stretch', 'Stretch'],
              ]}
              onChange={(v) => setFit(v === 'stretch' ? 'stretch' : 'cover')}
            />
            <SelectField
              label="Format"
              value={format}
              options={[
                ['png', 'PNG'],
                ['jpg', 'JPG'],
                ['webp', 'WEBP'],
              ]}
              onChange={setFormat}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Style</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField
              label="Corner radius"
              value={cornerRadius}
              min={0}
              max={64}
              disabled={isPolaroid}
              onChange={setCornerRadius}
            />
            <NumberField
              label="Frame width"
              value={frameWidth}
              min={0}
              max={40}
              disabled={isPolaroid || isStrip}
              onChange={setFrameWidth}
            />
            <ColorField
              label="Frame color"
              value={frameColor}
              disabled={isPolaroid || isStrip}
              onChange={setFrameColor}
            />
            <ColorField label="Background" value={background} disabled={isStrip} onChange={setBackground} />
          </div>
        </div>

        <p className="rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {images.length > 0
            ? `Using ${images.length} uploaded photo${images.length === 1 ? '' : 's'} in preview.`
            : 'Add photos to preview them. Showing placeholders.'}
        </p>
      </aside>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Live preview</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {ALBUM_TEMPLATES.find((t) => t.id === template)?.name} • {clamp(columns, 1, 8)} col
          </span>
        </div>
        <div className="flex max-h-[640px] items-center justify-center overflow-auto rounded-lg bg-slate-100 p-2 dark:bg-slate-900">
          <canvas
            ref={previewCanvasRef}
            className="max-w-full"
            style={{ imageRendering: 'auto' }}
          />
        </div>
      </div>
    </div>
  )
})

AlbumEditor.displayName = 'AlbumEditor'

export default AlbumEditor

