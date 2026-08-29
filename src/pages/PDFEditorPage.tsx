import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'
import jsPDF from 'jspdf'

export const PDFEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(3)
  const [brushColor, setBrushColor] = useState('#FF0000')
  const [textMode, setTextMode] = useState(false)
  const [textContent, setTextContent] = useState('')

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

    // Initialize canvas to simulate PDF page
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 600
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Draw PDF-like background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = '#ddd'
        ctx.lineWidth = 1
        ctx.strokeRect(0, 0, canvas.width, canvas.height)

        // Add some dummy text to simulate PDF content
        ctx.fillStyle = '#333'
        ctx.font = '14px Arial'
        ctx.fillText('PDF Document Annotation Editor', 20, 40)
        ctx.font = '12px Arial'
        ctx.fillText(`File: ${document.name}`, 20, 70)
      }
    }
  }, [document, navigate, addNotification])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textMode) return
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
    if (!isDrawing || textMode) return

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

  const handleAddText = () => {
    if (!textContent.trim()) return

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#000'
        ctx.font = '14px Arial'
        ctx.fillText(textContent, 20, 150)
        setTextContent('')
        addNotification({
          type: 'success',
          message: 'Text added to PDF.',
        })
      }
    }
  }

  const handleExportPDF = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const pdf = new jsPDF()
      const imgData = canvas.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297)
      pdf.save(`edited-${document?.name || 'document'}.pdf`)
      addNotification({
        type: 'success',
        message: 'PDF exported.',
      })
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

  return (
    <Layout title={`Editing: ${document.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{document.name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">PDF Annotation Editor</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Close
            </Button>
            <Button onClick={handleExportPDF}>Export PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
            <p className="text-sm font-semibold mb-3">Annotation Tools</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium">Pen Color</label>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="mt-1 h-10 w-full rounded cursor-pointer"
                  disabled={textMode}
                />
              </div>

              <div>
                <label className="text-xs font-medium">Pen Width</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="mt-1 w-full"
                  disabled={textMode}
                />
                <p className="text-xs text-slate-500 mt-1">{brushSize}px</p>
              </div>

              <div className="space-y-2">
                <Button
                  variant={textMode ? 'primary' : 'secondary'}
                  size="sm"
                  className="w-full"
                  onClick={() => setTextMode(!textMode)}
                >
                  {textMode ? 'Drawing Mode' : 'Text Mode'}
                </Button>
              </div>

              {textMode && (
                <div>
                  <input
                    type="text"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter text"
                    className="w-full px-2 py-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-700"
                  />
                  <Button size="sm" className="w-full mt-2" onClick={handleAddText}>
                    Add Text
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 p-4 flex justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className={`border-2 border-slate-300 dark:border-slate-700 ${
                textMode ? 'cursor-text' : 'cursor-crosshair'
              }`}
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}
