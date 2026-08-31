import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'
import { EditorToolbar } from '@components/ui/EditorToolbar'
import { Input } from '@components/ui/Input'
import jsPDF from 'jspdf'

export const DocumentEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents, renameDocument, saveDocumentContent } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState<string[]>([content])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isRenaming, setIsRenaming] = useState(false)
  const [documentName, setDocumentName] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [fontFamily, setFontFamily] = useState('monospace')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const document = documents.find((doc) => doc.id === documentId)

  useEffect(() => {
    if (!document) {
      addNotification({
        type: 'error',
        message: 'Document not found.',
      })
      navigate('/files')
      return
    }
    setDocumentName(document.name)
  }, [document, navigate, addNotification])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    window.document.addEventListener('mousedown', handleClickOutside)
    return () => window.document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    if (historyIndex < history.length - 1) {
      setHistory(history.slice(0, historyIndex + 1))
    }
    setHistory([...history, newContent])
    setHistoryIndex(history.length)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setContent(history[historyIndex - 1])
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setContent(history[historyIndex + 1])
    }
  }

  const handleBold = () => {
    const textarea = globalThis.document.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = content.substring(start, end)
      const before = content.substring(0, start)
      const after = content.substring(end)
      const newContent = `${before}**${selectedText}**${after}`
      handleContentChange(newContent)
    }
  }

  const handleItalic = () => {
    const textarea = globalThis.document.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = content.substring(start, end)
      const before = content.substring(0, start)
      const after = content.substring(end)
      const newContent = `${before}*${selectedText}*${after}`
      handleContentChange(newContent)
    }
  }

  const handleUnderline = () => {
    const textarea = globalThis.document.querySelector('textarea') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = content.substring(start, end)
      const before = content.substring(0, start)
      const after = content.substring(end)
      const newContent = `${before}__${selectedText}__${after}`
      handleContentChange(newContent)
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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      saveDocumentContent(document!.id, content)
      addNotification({
        type: 'success',
        message: 'Document saved successfully.',
      })
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to save document.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = globalThis.document.createElement('a')
    a.href = url
    a.download = filename
    globalThis.document.body.appendChild(a)
    a.click()
    globalThis.document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportTXT = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    downloadFile(blob, `${document?.name || 'document'}.txt`)
    setShowExportMenu(false)
    addNotification({ type: 'success', message: 'Exported as TXT.' })
  }

  const handleExportMD = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const baseName = document?.name?.replace(/\.[^.]+$/, '') || 'document'
    downloadFile(blob, `${baseName}.md`)
    setShowExportMenu(false)
    addNotification({ type: 'success', message: 'Exported as Markdown.' })
  }

  const handleExportHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${document?.name || 'Document'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
  pre { background: #f4f4f4; padding: 16px; border-radius: 4px; overflow-x: auto; }
  code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
  h1, h2, h3 { color: #1a1a1a; }
  img { max-width: 100%; }
  blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f4f4f4; }
</style>
</head>
<body>
${content.replace(/\n/g, '<br>\n')}
</body>
</html>`
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const baseName = document?.name?.replace(/\.[^.]+$/, '') || 'document'
    downloadFile(blob, `${baseName}.html`)
    setShowExportMenu(false)
    addNotification({ type: 'success', message: 'Exported as HTML.' })
  }

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const maxWidth = pageWidth - margin * 2
    const lineHeight = 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)

    const lines = doc.splitTextToSize(content, maxWidth)
    let y = margin

    for (let i = 0; i < lines.length; i++) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(lines[i], margin, y)
      y += lineHeight
    }

    const baseName = document?.name?.replace(/\.[^.]+$/, '') || 'document'
    doc.save(`${baseName}.pdf`)
    setShowExportMenu(false)
    addNotification({ type: 'success', message: 'Exported as PDF.' })
  }

  const handleExportJSON = () => {
    const jsonData = {
      name: document?.name || 'document',
      content,
      exportedAt: new Date().toISOString(),
      wordCount: content.split(/\s+/).filter(Boolean).length,
      charCount: content.length,
    }
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
    const baseName = document?.name?.replace(/\.[^.]+$/, '') || 'document'
    downloadFile(blob, `${baseName}.json`)
    setShowExportMenu(false)
    addNotification({ type: 'success', message: 'Exported as JSON.' })
  }

  const handleInsertImage = () => {
    const input = globalThis.document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        const imageMarkdown = `\n![${file.name}](${dataUrl})\n`
        const newContent = content + imageMarkdown
        handleContentChange(newContent)
        addNotification({ type: 'success', message: 'Image inserted into document.' })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length
  const charCount = content.length
  const lineCount = content.split('\n').length

  if (!document) {
    return (
      <Layout title="Document Editor">
        <div className="flex items-center justify-center p-12">
          <p>Document not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={`Editing: ${document.name}`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename()
                    if (e.key === 'Escape') {
                      setDocumentName(document.name)
                      setIsRenaming(false)
                    }
                  }}
                  className="text-xl font-bold"
                  autoFocus
                />
                <Button size="sm" onClick={handleRename}>Save</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDocumentName(document.name)
                    setIsRenaming(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <h1
                  className="text-2xl font-bold cursor-pointer hover:text-primary-600 transition-colors"
                  onClick={() => setIsRenaming(true)}
                  title="Click to rename"
                >
                  {document.name}
                </h1>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="text-slate-400 hover:text-primary-600 transition-colors"
                  title="Rename document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Close
            </Button>
            <div className="relative" ref={exportMenuRef}>
              <Button variant="secondary" onClick={() => setShowExportMenu(!showExportMenu)}>
                Export ▾
              </Button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 z-10">
                  <button onClick={handleExportTXT} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-t-lg">
                    📄 Export as TXT
                  </button>
                  <button onClick={handleExportMD} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                    📝 Export as Markdown
                  </button>
                  <button onClick={handleExportHTML} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                    🌐 Export as HTML
                  </button>
                  <button onClick={handleExportPDF} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                    📕 Export as PDF
                  </button>
                  <button onClick={handleExportJSON} className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-b-lg">
                    📋 Export as JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <EditorToolbar
          onBold={handleBold}
          onItalic={handleItalic}
          onUnderline={handleUnderline}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <div className="hidden rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950 lg:block space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Insert</p>
              <Button variant="secondary" size="sm" className="w-full" onClick={handleInsertImage}>
                🖼️ Insert Image
              </Button>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Font Settings</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
                  >
                    <option value="monospace">Monospace</option>
                    <option value="sans-serif">Sans Serif</option>
                    <option value="serif">Serif</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="'Courier New'">Courier New</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Size: {fontSize}px</label>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Statistics</p>
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p>Words: <span className="font-medium">{wordCount}</span></p>
                <p>Characters: <span className="font-medium">{charCount}</span></p>
                <p>Lines: <span className="font-medium">{lineCount}</span></p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Markdown Syntax</p>
              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">**bold**</code></p>
                <p><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">*italic*</code></p>
                <p><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">__underline__</code></p>
                <p><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded"># Heading</code></p>
                <p><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">- List item</code></p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start typing your document here..."
              className="w-full h-[500px] rounded-lg p-4 border-0 bg-transparent resize-none focus:outline-none focus:ring-0"
              style={{ fontSize: `${fontSize}px`, fontFamily }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{wordCount} words | {charCount} chars | {lineCount} lines</span>
          <span>💾 {isSaving ? 'Saving...' : 'Saved'}</span>
        </div>
      </div>
    </Layout>
  )
}
