import React, { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'

export const ImageEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(5)
  const [brushColor, setBrushColor] = useState('#000000')

  const document = documents.find((doc) => doc.id === documentId)

  useEffect(() => {
    if (!document) {
      addNotification({
        type: 'error',
        message: 'Image not found.',
      })
      navigate('/files')
      return
    }

    // Initialize canvas
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [document, navigate, addNotification])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = brushColor
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const link = globalThis.document.createElement('a')
      link.href = canvas.toDataURL()
      link.download = `edited-${document?.name || 'image'}.png`
      link.click()
      addNotification({
        type: 'success',
        message: 'Image downloaded.',
      })
    }
  }

  if (!document) {
    return (
      <Layout title="Image Editor">
        <div className="flex items-center justify-center p-12">
          <p>Image not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={`Editing: ${document.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{document.name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Image Editor</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Close
            </Button>
            <Button onClick={handleDownload}>Download</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm p-4 dark:border-slate-700">
            <p className="text-sm font-semibold mb-3">Tools</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium">Brush Color</label>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="mt-1 h-10 w-full rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-medium">Brush Size</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="mt-1 w-full"
                />
                <p className="text-xs text-slate-500 mt-1">{brushSize}px</p>
              </div>

              <Button variant="secondary" size="sm" className="w-full" onClick={handleClear}>
                Clear Canvas
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm dark:border-slate-700 p-4 flex justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="border-2 border-slate-300 cursor-crosshair dark:border-slate-700 max-w-full"
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}
