import React from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Badge } from '@components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/Card'
import { useFileManagerStore } from '@store/fileManagerStore'
import { useUIStore } from '@store/uiStore'
import { formatFileSize } from '@utils/helpers'
import { getEditorRoute } from '@utils/routes'

const statAccentClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
}

const createDocumentRecord = (name: string, ownerId: string) => {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name,
    type: 'txt' as const,
    size: 0,
    createdAt: now,
    updatedAt: now,
    ownerId,
    shared: false,
    views: 0,
  }
}

export const DashboardPage: React.FC = () => {
  const { documents, addDocument } = useFileManagerStore()
  const { addNotification } = useUIStore()
  const storageUsed = documents.reduce((total, document) => total + document.size, 0)
  const recentDocuments = documents.slice(0, 5)

  const handleCreateDocument = () => {
    const userId = crypto.randomUUID()
    const nextNumber = documents.filter((document) => document.name.startsWith('Untitled document')).length + 1
    const document = createDocumentRecord(`Untitled document ${nextNumber}.txt`, userId)
    addDocument(document)
    addNotification({
      type: 'success',
      message: 'Document created.',
    })
  }

  return (
    <Layout title="Dashboard">
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Files', value: documents.length.toString(), tone: 'blue' },
          { label: 'Storage used', value: formatFileSize(storageUsed), tone: 'green' },
          { label: 'Recent files', value: recentDocuments.length.toString(), tone: 'violet' },
          { label: 'Shared items', value: documents.filter((document) => document.shared).length.toString(), tone: 'amber' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-bold">{item.value}</p>
              <div className={`mt-4 h-1.5 rounded-full ${statAccentClasses[item.tone as keyof typeof statAccentClasses]}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Your workspace</CardTitle>
                <CardDescription>Create a document or open your files.</CardDescription>
              </div>
              <Badge variant="success">All features available</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={handleCreateDocument}
                className="rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-orange-400 dark:border-slate-700 dark:hover:border-primary-500"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">New document</span>
                <span className="mt-2 block text-sm text-slate-600 dark:text-slate-400">
                  Start a blank text document.
                </span>
              </button>

              <Link
                to="/files"
                className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-orange-400 dark:border-slate-700 dark:hover:border-primary-500"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Open files</span>
                <span className="mt-2 block text-sm text-slate-600 dark:text-slate-400">
                  Upload, search, and manage documents.
                </span>
              </Link>

              <Link
                to="/tools"
                className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-orange-400 dark:border-slate-700 dark:hover:border-primary-500"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">View tools</span>
                <span className="mt-2 block text-sm text-slate-600 dark:text-slate-400">
                  See what is available for your account.
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent files</CardTitle>
            <CardDescription>Your newest documents appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {recentDocuments.map((document) => (
                  <Link key={document.id} to={getEditorRoute(document.type, document.id)}>
                    <div className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-orange-400 dark:border-slate-700 dark:hover:border-primary-500">
                      <p className="truncate text-sm font-semibold">{document.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatFileSize(document.size)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">No files yet. Create or upload one to begin.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
