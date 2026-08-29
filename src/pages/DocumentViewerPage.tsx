import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Button } from '@components/ui/Button'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'

export const DocumentViewerPage: React.FC = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { documents } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const [preview, setPreview] = useState<React.ReactNode>(null)
  const [loading, setLoading] = useState(true)

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

    // Simulate loading
    setLoading(false)

    if (document.type === 'image') {
      setPreview(
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`}
            alt="Image preview"
            className="max-w-full rounded-lg"
          />
        </div>
      )
    } else if (document.type === 'pdf') {
      setPreview(
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-12 dark:border-slate-600 dark:bg-slate-900">
          <div className="text-center">
            <p className="text-lg font-semibold">PDF Preview</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{document.name}</p>
            <p className="mt-4 text-xs text-slate-500">Full PDF viewer coming soon</p>
          </div>
        </div>
      )
    } else if (document.type === 'docx') {
      setPreview(
        <div className="rounded-lg border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-950">
          <div className="prose dark:prose-invert">
            <h1>Document Preview: {document.name}</h1>
            <p>DOCX document content will be rendered here.</p>
            <p>This is a demonstration. Full DOCX rendering coming soon.</p>
          </div>
        </div>
      )
    } else if (document.type === 'xlsx') {
      setPreview(
        <div className="rounded-lg border border-slate-200 overflow-x-auto dark:border-slate-700">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b dark:border-slate-700">
                <td className="bg-slate-100 p-3 font-semibold dark:bg-slate-800">Column A</td>
                <td className="bg-slate-100 p-3 font-semibold dark:bg-slate-800">Column B</td>
                <td className="bg-slate-100 p-3 font-semibold dark:bg-slate-800">Column C</td>
              </tr>
              <tr className="border-b dark:border-slate-700">
                <td className="p-3">Sample data</td>
                <td className="p-3">Sample data</td>
                <td className="p-3">Sample data</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-slate-500 p-3">Full spreadsheet preview coming soon</p>
        </div>
      )
    } else {
      setPreview(
        <div className="rounded-lg border border-slate-200 bg-white p-8 font-mono text-sm dark:border-slate-700 dark:bg-slate-950">
          <p>Text document: {document.name}</p>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Document content preview</p>
        </div>
      )
    }
  }, [document, navigate, addNotification])

  if (!document) {
    return (
      <Layout title="Document Viewer">
        <div className="flex items-center justify-center p-12">
          <p>Document not found</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={`Viewing: ${document.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{document.name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Type: {document.type.toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/files')}>
              Back to files
            </Button>
            <Button type="button">Download</Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-950">
          {loading ? <p>Loading...</p> : preview}
        </div>
      </div>
    </Layout>
  )
}
