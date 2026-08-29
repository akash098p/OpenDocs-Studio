// ---------------------------------------------------------------------------
// Album rendering — shared by the Custom Album Creator editor (live preview)
// and the imageAlbum processor (final export) so the preview is WYSIWYG.
// ---------------------------------------------------------------------------

export interface AlbumRenderOptions {
  images: HTMLImageElement[]
  template: string
  thumbW: number
  thumbH: number
  columns: number
  spacing: number
  fit: 'stretch' | 'cover'
  cornerRadius: number
  frameWidth: number
  frameColor: string
  background: string
}

export const ALBUM_TEMPLATES: Array<{ id: string; name: string; description: string }> = [
  { id: 'classic', name: 'Classic Grid', description: 'Uniform photo grid' },
  { id: 'rounded', name: 'Rounded Cards', description: 'Soft corners with soft shadows' },
  { id: 'polaroid', name: 'Polaroid', description: 'Framed cards with caption strips, lightly tilted' },
  { id: 'strip', name: 'Film Strip', description: 'Single-row film strip with sprocket holes' },
  { id: 'hero', name: 'Hero + Grid', description: 'One large lead photo above a grid' },
]

export const normalizeHexColor = (raw: string, fallback = '#FFFFFF'): string => {
  const value = String(raw || '').trim()
  const hex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value)
  if (!hex) return fallback
  const digits = hex[1].split('')
  const full = digits.length === 3 ? digits.map((d) => d + d) : digits
  return `#${full.join('').toUpperCase()}`
}

export function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

interface TileStyle {
  fit: 'stretch' | 'cover'
  radius: number
  frameWidth: number
  frameColor: string
  shadow: boolean
}

function drawTile(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, style: TileStyle): void {
  const styled = style.frameWidth > 0 || style.shadow || style.radius > 0
  ctx.save()
  if (!styled) {
    if (style.fit === 'cover') drawCover(ctx, image, x, y, w, h)
    else ctx.drawImage(image, x, y, w, h)
    ctx.restore()
    return
  }
  if (style.shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
  }
  traceRoundRect(ctx, x, y, w, h, style.radius)
  ctx.fillStyle = style.frameColor
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  const inset = Math.min(style.frameWidth, Math.floor(Math.min(w, h) / 4))
  const ix = x + inset
  const iy = y + inset
  const iw = Math.max(1, w - inset * 2)
  const ih = Math.max(1, h - inset * 2)
  ctx.save()
  traceRoundRect(ctx, ix, iy, iw, ih, Math.max(0, style.radius - inset))
  ctx.clip()
  if (style.fit === 'cover') drawCover(ctx, image, ix, iy, iw, ih)
  else ctx.drawImage(image, ix, iy, iw, ih)
  ctx.restore()
  ctx.restore()
}

export function renderAlbum(options: AlbumRenderOptions): HTMLCanvasElement {
  const images = options.images
  const thumbW = Math.max(32, Math.round(options.thumbW))
  const thumbH = Math.max(32, Math.round(options.thumbH))
  const spacing = Math.max(0, Math.round(options.spacing))
  const columns = Math.max(1, Math.round(options.columns))
  const radius = Math.max(0, Math.round(options.cornerRadius))
  const frameWidth = Math.max(0, Math.round(options.frameWidth))
  const frameColor = normalizeHexColor(options.frameColor, '#FFFFFF')
  const background = normalizeHexColor(options.background, '#FFFFFF')
  const fit = options.fit === 'stretch' ? 'stretch' : 'cover'
  const template = options.template

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context.')

  const count = images.length
  if (count === 0) {
    canvas.width = thumbW
    canvas.height = thumbH
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return canvas
  }

  const drawGridTiles = (startIndex: number, tileCount: number, cols: number, startY: number, tileW: number, tileH: number, style: TileStyle) => {
    for (let i = 0; i < tileCount; i += 1) {
      const image = images[startIndex + i]
      if (!image) break
      const col = i % cols
      const row = Math.floor(i / cols)
      drawTile(ctx, image, col * (tileW + spacing), startY + row * (tileH + spacing), tileW, tileH, style)
    }
  }

  if (template === 'polaroid') {
    const pad = Math.max(6, Math.round(thumbW * 0.06))
    const caption = Math.max(14, Math.round(thumbW * 0.2))
    const cols = Math.min(columns, count)
    const rows = Math.ceil(count / cols)
    const margin = Math.max(spacing, 18)
    const cellH = thumbH + caption
    canvas.width = margin * 2 + cols * thumbW + (cols - 1) * spacing
    canvas.height = margin * 2 + rows * cellH + (rows - 1) * spacing
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const rotations = [-3, 2, -2, 3, 1.5, -1.5]
    images.forEach((image, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = margin + col * (thumbW + spacing) + thumbW / 2
      const cy = margin + row * (cellH + spacing) + cellH / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(((rotations[i % rotations.length]) * Math.PI) / 180)
      const x = -thumbW / 2
      const y = -cellH / 2
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 3
      ctx.fillStyle = frameColor
      traceRoundRect(ctx, x, y, thumbW, cellH, 4)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
      ctx.save()
      traceRoundRect(ctx, x + pad, y + pad, thumbW - pad * 2, thumbH - pad, 2)
      ctx.clip()
      drawCover(ctx, image, x + pad, y + pad, thumbW - pad * 2, thumbH - pad)
      ctx.restore()
      ctx.restore()
    })
    return canvas
  }

  if (template === 'strip') {
    const pad = 26
    canvas.width = pad * 2 + count * thumbW + (count - 1) * spacing
    canvas.height = thumbH + pad * 2
    ctx.fillStyle = '#151515'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    for (let x = 12; x + 10 <= canvas.width - 12; x += 20) {
      traceRoundRect(ctx, x, 8, 10, 8, 2)
      ctx.fill()
      traceRoundRect(ctx, x, canvas.height - 16, 10, 8, 2)
      ctx.fill()
    }
    const y = Math.round((canvas.height - thumbH) / 2)
    images.forEach((image, i) => {
      drawTile(ctx, image, pad + i * (thumbW + spacing), y, thumbW, thumbH, { fit, radius, frameWidth, frameColor, shadow: false })
    })
    return canvas
  }

  if (template === 'hero') {
    const gridCount = Math.max(0, count - 1)
    const gridCols = Math.min(columns, gridCount || 1)
    const gridRows = Math.ceil(gridCount / gridCols)
    const heroH = Math.round(thumbH * 1.4)
    canvas.width = Math.max(gridCols * thumbW + (gridCols - 1) * spacing, thumbW)
    canvas.height = heroH + (gridRows > 0 ? spacing + gridRows * thumbH + (gridRows - 1) * spacing : 0)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const style: TileStyle = { fit, radius, frameWidth, frameColor, shadow: radius > 0 || frameWidth > 0 }
    drawTile(ctx, images[0], 0, 0, canvas.width, heroH, style)
    drawGridTiles(1, gridCount, gridCols, heroH + spacing, thumbW, thumbH, style)
    return canvas
  }

  // classic + rounded (rounded enforces a minimum corner radius for the card look)
  const effRadius = template === 'rounded' ? Math.max(radius, 14) : radius
  const style: TileStyle = { fit, radius: effRadius, frameWidth, frameColor, shadow: effRadius > 0 || frameWidth > 0 }
  const cols = Math.min(columns, count)
  const rows = Math.ceil(count / cols)
  canvas.width = cols * thumbW + (cols - 1) * spacing
  canvas.height = rows * thumbH + (rows - 1) * spacing
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  drawGridTiles(0, count, cols, 0, thumbW, thumbH, style)
  return canvas
}

