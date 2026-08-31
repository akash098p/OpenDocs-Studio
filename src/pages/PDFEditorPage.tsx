import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'
import { Input } from '@components/ui/Input'
import jsPDF from 'jspdf'
import { PDFDocument } from 'pdf-lib'

export const PDFEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents, renameDocument } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(3)
  const [brushColor, setBrushColor] = useState('#FF0000')
  const [textContent, setTextContent] = useState('')
  const [tool, setTool] = useState<'pen' | 'highlight' | 'eraser' | 'text' | 'image' | 'shape'>('pen')
  const [shapeType, setShapeType] = useState<'rectangle' | 'circle' | 'line'>('rectangle')
  const [isRenaming, setIsRenaming] = useState(false)
  const [documentName, setDocumentName] = useState('')
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [pages, setPages] = useState<Array<{ id: string; dataUrl: string }>>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [imageStamp, setImageStamp] = useState<string | null>(null)

  const document = documents.find((doc) => doc.id === documentId)

  useEffect(() => {
    if (!document) {
      addNotification({
        type: 'error',
        message: 'PDF not found.',
      })
      navigate('/files')
      return
    }
    setDocumentName(document.name)
    initializeCanvas()
  }, [document, navigate, addNotification])

  const initializeCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 612
      canvas.height = 792
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#ddd'
        ctx.lineWidth = 1
        ctx.strokeRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = '#333'
        ctx.font = '16px Arial'
        ctx.fillText('PDF Document Editor', 20, 40)
        ctx.font = '12px Arial'
        ctx.fillText(`File: ${document?.name}`, 20, 65)
        ctx.fillStyle = '#666'
        ctx.fillText('Use the tools on the left to annotate, draw, add text, or import images.', 20, 90)

        if (pages.length === 0) {
          setPages([{ id: crypto.randomUUID(), dataUrl: canvas.toDataURL() }])
        }
      }
    }
  }

  const handleRename = () => {
    if (!documentName.trim()) {
      addNotification({ type: 'error', message: 'Document name cannot be empty.' })
      return
    }
    renameDocument(document!.id, documentName.trim())
    setIsRenaming(false)
    addNotification({ type: 'success', message: 'Document renamed successfully.' })
  }

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImageStamp(dataUrl)
      setTool('image')
      addNotification({ type: 'success', message: 'Image loaded. Click on the canvas to place it.' })
    }
    reader.readAsDataURL(file)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleImportPDF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(new Uint8Array(arrayBuffer), { ignoreEncryption: true })
      const pageCount = pdfDoc.getPageCount()

      addNotification({ type: 'success', message: `PDF loaded with ${pageCount} page(s). Rendering...` })

      const { getDocument } = await import('pdfjs-dist')
      const pdf = await getDocument({ data: arrayBuffer }).promise
      const newPages: Array<{ id: string; dataUrl: string }> = []

      for (let i = 1; i <= Math.min(pageCount, 10); i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = window.document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          newPages.push({ id: crypto.randomUUID(), dataUrl: canvas.toDataURL('image/jpeg', 0.8) })
        }
      }

      setPages(newPages)
      setCurrentPage(0)
      addNotification({ type: 'success', message: `Rendered ${newPages.length} page(s).` })
    } catch (err) {
      addNotification({ type: 'error', message: 'Failed to load PDF. Make sure it is a valid PDF file.' })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') return
    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasCoords(e)

    if (tool === 'image' && imageStamp) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const img = new Image()
        img.onload = () => {
          const maxW = 150
          const maxH = 150
        const ratio = Math.min(maxW / img.width, maxH / img.height)
        const w = img.width * ratio
        const h = img.height * ratio
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h)
        addNotification({ type: 'success', message: 'Image placed on PDF.' })
        }
        img.src = imageStamp
      }
      return
    }

    setIsDrawing(true)
    setStartPos({ x, y })

    const ctx = canvas.getContext('2d')
    if (ctx) {
      if (tool === 'pen' || tool === 'highlight') {
        ctx.beginPath()
        ctx.moveTo(x, y)
      }
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'text' || tool === 'image') return

    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasCoords(e)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (tool === 'pen') {
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = brushColor
      ctx.lineTo(x, y)
      ctx.stroke()
    } else if (tool === 'highlight') {
      ctx.lineWidth = brushSize * 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = brushColor
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.globalAlpha = 1
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = brushSize * 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) {
      setIsDrawing(false)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasCoords(e)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (tool === 'shape') {
      ctx.strokeStyle = brushColor
      ctx.lineWidth = brushSize
      if (shapeType === 'rectangle') {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y)
      } else if (shapeType === 'circle') {
        const rx = Math.abs(x - startPos.x) / 2
        const ry = Math.abs(y - startPos.y) / 2
        const cx = startPos.x + (x - startPos.x) / 2
        const cy = startPos.y + (y - startPos.y) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (shapeType === 'line') {
        ctx.beginPath()
        ctx.moveTo(startPos.x, startPos.y)
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    }

    setIsDrawing(false)
    setStartPos(null)
  }

  const handleAddText = () => {
    if (!textContent.trim()) return

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = brushColor
        ctx.font = `${brushSize * 3 + 10}px Arial`
        ctx.fillText(textContent, 50, 200)
        setTextContent('')
        addNotification({
          type: 'success',
          message: 'Text added to PDF.',
        })
      }
    }
  }

  const handleClearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        addNotification({ type: 'success', message: 'Canvas cleared.' })
      }
    }
  }

  const handleAddPage = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const dataUrl = canvas.toDataURL()
      setPages([...pages, { id: crypto.randomUUID(), dataUrl }])
      setCurrentPage(pages.length)
      handleClearCanvas()
      addNotification({ type: 'success', message: 'New page added.' })
    }
  }

  const handleDeletePage = () => {
    if (pages.length <= 1) {
      addNotification({ type: 'warning', message: 'Cannot delete the only page.' })
      return
    }
    const newPages = pages.filter((_, i) => i !== currentPage)
    setPages(newPages)
    setCurrentPage(Math.max(0, currentPage - 1))
    addNotification({ type: 'success', message: 'Page deleted.' })
  }

  const handleExportPDF = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage()
        const dataUrl = i === currentPage ? imgData : pages[i].dataUrl
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, pageHeight)
      }

      const baseName = document?.name?.replace(/\.pdf$/i, '') || 'document'
      pdf.save(`${baseName}.pdf`)
      addNotification({
        type: 'success',
        message: `PDF exported with ${pages.length} page(s).`,
      })
    }
  }

  const handleExportPNG = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const link = window.document.createElement('a')
      link.download = `${document?.name?.replace(/\.pdf$/i, '') || 'document'}-page${currentPage + 1}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      addNotification({ type: 'success', message: 'Exported current page as PNG.' })
    }
  }

  if (!document) {
    return (
      <Layout title="PDF Editor">
        <div className="flex items-center justify-center p-12">
          <p>PDF not found</p>
        </div>
      </Layout>
    )
  }

  const getCursorClass = () => {
    if (tool === 'text') return 'cursor-text'
    if (tool === 'image') return 'cursor-copy'
    if (tool === 'eraser') return 'cursor-cell'
    return 'cursor-crosshair'
  }

  return (
    <Layout title={`Editing: ${document.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename()
                    if (e.key === 'Escape') { setDocumentName(document.name); setIsRenaming(false) }
                  }}
                  className="text-lg font-bold"
                  autoFocus
                />
                <Button size="sm" onClick={handleRename}>Save</Button>
                <Button size="sm" variant="secondary" onClick={() => { setDocumentName(document.name); setIsRenaming(false) }}>Cancel</Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold cursor-pointer hover:text-primary-600 transition-colors" onClick={() => setIsRenaming(true)} title="Click to rename">
                  {document.name}
                </h1>
                <button onClick={() => setIsRenaming(true)} className="text-slate-400 hover:text-primary-600" title="Rename">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input ref={fileInputRef} type="file" accept="application/pdf" className="sr-only" onChange={handleImportPDF} />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              📂 Import PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPNG}>PNG</Button>
            <Button onClick={handleExportPDF}>Export PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <p className="text-sm font-semibold mb-2">Drawing Tools</p>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { id: 'pen', icon: '✏️', label: 'Pen' },
                  { id: 'highlight', icon: '🖍️', label: 'Highlight' },
                  { id: 'eraser', icon: '🧹', label: 'Eraser' },
                  { id: 'text', icon: '📝', label: 'Text' },
                  { id: 'shape', icon: '⬜', label: 'Shape' },
                  { id: 'image', icon: '🖼️', label: 'Image' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTool(t.id as typeof tool) }}
                    className={`flex flex-col items-center gap-1 rounded p-2 text-xs transition-colors ${tool === t.id ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    title={t.label}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {tool === 'shape' && (
              <div>
                <p className="text-xs font-medium mb-1">Shape Type</p>
                <div className="flex gap-1">
                  {(['rectangle', 'circle', 'line'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setShapeType(s)}
                      className={`flex-1 rounded px-2 py-1 text-xs ${shapeType === s ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === 'image' && (
              <div>
                <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageImport} />
                <Button variant="secondary" size="sm" className="w-full" onClick={() => imageInputRef.current?.click()}>
                  📷 Load Image Stamp
                </Button>
                {imageStamp && <p className="text-xs text-green-600 mt-1">✓ Image loaded - click to place</p>}
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Color</label>
              <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} className="mt-1 h-8 w-full rounded cursor-pointer" />
            </div>

            <div>
              <label className="text-xs font-medium">Size: {brushSize}px</label>
              <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="mt-1 w-full" />
            </div>

            {tool === 'text' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter text to add"
                  className="w-full px-2 py-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-700"
                />
                <Button size="sm" className="w-full" onClick={handleAddText}>Add Text to PDF</Button>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <p className="text-sm font-semibold mb-2">Pages ({pages.length})</p>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" className="flex-1" onClick={handleAddPage}>+ Add</Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={handleDeletePage}>- Delete</Button>
              </div>
              {pages.length > 1 && (
                <div className="flex items-center gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>◀</Button>
                  <span className="text-xs text-slate-600 dark:text-slate-400 flex-1 text-center">Page {currentPage + 1} / {pages.length}</span>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1}>▶</Button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <Button variant="secondary" size="sm" className="w-full" onClick={handleClearCanvas}>🗑️ Clear Canvas</Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 p-4 flex justify-center overflow-auto">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className={`border-2 border-slate-300 dark:border-slate-700 max-w-full ${getCursorClass()}`}
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}
