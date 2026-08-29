import React from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Document } from '@/types/files'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'
import { formatDate, formatFileSize } from '@utils/helpers'
import { getEditorRoute, getViewerRoute } from '@utils/routes'

const supportedExtensions = ['pdf', 'docx', 'txt', 'csv', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp']

const detectDocumentType = (fileName: string): Document['type'] => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return 'pdf'
  if (extension === 'docx') return 'docx'
  if (extension === 'xlsx' || extension === 'csv') return 'xlsx'
  if (extension === 'pptx') return 'pptx'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension || '')) return 'image'
  return 'txt'
}

export const FilesPage: React.FC = () => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { documents, addDocument, removeDocument } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const [query, setQuery] = React.useState('')

  const visibleDocuments = documents.filter((document) =>
    document.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const handleUpload = (files: FileList | null) => {
    if (!files?.length) return

    const userId = crypto.randomUUID()

    Array.from(files).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !supportedExtensions.includes(extension)) {
        addNotification({
          type: 'error',
          message: `${file.name} is not a supported file type.`,
        })
        return
      }

      const now = new Date().toISOString()
      addDocument({
        id: crypto.randomUUID(),
        name: file.name,
        type: detectDocumentType(file.name),
        size: file.size,
        createdAt: now,
        updatedAt: now,
        ownerId: userId,
        shared: false,
        views: 0,
      })
    })

    addNotification({
      type: 'success',
      message: `${files.length} file${files.length === 1 ? '' : 's'} added.`,
    })

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleDelete = (documentId: string) => {
    removeDocument(documentId)
    addNotification({
      type: 'success',
      message: 'File removed.',
    })
  }

  return (
    <Layout title="Files">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>My files</CardTitle>
                <CardDescription>Upload and organize documents in this browser workspace.</CardDescription>
              </div>
              <Badge variant="success">All features enabled</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                label="Search files"
                placeholder="Search by file name"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex items-end">
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="sr-only"
                  accept={supportedExtensions.map((extension) => `.${extension}`).join(',')}
                  onChange={(event) => handleUpload(event.target.files)}
                />
                <Button type="button" className="w-full md:w-auto" onClick={() => inputRef.current?.click()}>
                  Upload files
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              {visibleDocuments.length > 0 ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {visibleDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_100px_100px_120px_auto] md:items-center"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{document.name}</p>
                        <p className="mt-1 text-xs uppercase text-slate-500 dark:text-slate-400">{document.type}</p>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{formatFileSize(document.size)}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{formatDate(document.updatedAt)}</p>
                      <div className="flex gap-2">
                        <Link to={getViewerRoute(document.id)}>
                          <Button variant="secondary" size="sm" type="button">
                            View
                          </Button>
                        </Link>
                        <Link to={getEditorRoute(document.type, document.id)}>
                          <Button variant="secondary" size="sm" type="button">
                            Edit
                          </Button>
                        </Link>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        type="button"
                        onClick={() => handleDelete(document.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="font-semibold text-slate-900 dark:text-white">No files found</p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Upload a supported file or adjust your search.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
