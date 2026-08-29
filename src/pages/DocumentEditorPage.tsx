import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'
import { EditorToolbar } from '@components/ui/EditorToolbar'

export const DocumentEditorPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [history, setHistory] = useState<string[]>([content])
  const [historyIndex, setHistoryIndex] = useState(0)

  const document = documents.find((doc) => doc.id === documentId)

  useEffect(() => {
    if (!document) {
      addNotification({
        type: 'error',
        message: 'Document not found.',
      })
      navigate('/files')
    }
  }, [document, navigate, addNotification])

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

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
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

  const handleExport = () => {
    const element = globalThis.document.createElement('a')
    const file = new Blob([content], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `${document?.name || 'document'}.txt`
    globalThis.document.body.appendChild(element)
    element.click()
    globalThis.document.body.removeChild(element)
    addNotification({
      type: 'success',
      message: 'Document exported.',
    })
  }

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
          <div>
            <h1 className="text-2xl font-bold">{document.name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Type: {document.type.toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Close
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Export
            </Button>
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
          <div className="hidden rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950 lg:block">
            <p className="text-sm font-semibold">Formatting</p>
            <div className="mt-3 space-y-2 text-xs">
              <button className="w-full rounded px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                Headers
              </button>
              <button className="w-full rounded px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                Lists
              </button>
              <button className="w-full rounded px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                Links
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start typing your document here..."
              className="w-full h-96 rounded-lg p-4 border-0 bg-transparent resize-none focus:outline-none focus:ring-0 font-mono text-sm"
            />
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          💾 {isSaving ? 'Saving...' : 'Saved'}
        </div>
      </div>
    </Layout>
  )
}
