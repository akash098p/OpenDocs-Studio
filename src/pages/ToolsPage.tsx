import React, { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '@layouts/AppLayout'
import { Badge } from '@components/ui/Badge'
import { ToolRunner } from '@components/tools/ToolRunner'
import { useUIStore } from '@store/uiStore'
import { getToolById, toolsByGroup, toolDefinitions } from '@/tools/registry'
import { ToolDefinition } from '@/tools/types'
import { ToolGroup } from '@/tools/types'

const groupDescriptions: Partial<Record<ToolGroup, string>> = {
  Image: 'Resize, crop, compress, convert, watermark and organize pictures — all locally in your browser.',
  PDF: 'Merge, split, rotate, convert and render PDF documents without uploading them anywhere.',
}

const ToolCard: React.FC<{ tool: ToolDefinition }> = ({ tool }) => (
  <Link
    to={`/tools/${tool.id}`}
    className="group rounded-lg border-2 border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70 backdrop-blur-sm p-5 transition-colors hover:border-goldenrod-400 dark:hover:border-primary-500"
  >
    <div className="flex items-start gap-4">
      <img src={tool.icon} alt="" className="h-11 w-11 shrink-0 rounded-lg" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900 dark:text-white">{tool.name}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{tool.description}</p>
        <span className="mt-3 inline-block text-sm font-medium text-orange-600 group-hover:underline dark:text-primary-400">
          Open tool →
        </span>
      </div>
    </div>
  </Link>
)

export const ToolsPage: React.FC = () => {
  return (
    <Layout title="Tools">
      <div className="space-y-8">
        <section className="rounded-lg border border-orange-200 bg-white/70 backdrop-blur-sm p-6 dark:border-slate-800 dark:bg-slate-900/70">
          <Badge variant="success">100% client-side</Badge>
          <h2 className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">Image &amp; PDF tools</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Every tool runs entirely inside your browser. Your files never leave this device — pick a tool below to get
            started.
          </p>
        </section>

        {(['Image', 'PDF'] as ToolGroup[]).map((group) => (
          <section key={group}>
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{group} tools</h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">{toolsByGroup(group).length} tools</span>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{groupDescriptions[group]}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {toolsByGroup(group).map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Layout>
  )
}

export const ToolDetailPage: React.FC = () => {
  const { toolId } = useParams<{ toolId: string }>()
  const navigate = useNavigate()
  const { addNotification } = useUIStore()
  const tool = toolId ? getToolById(toolId) : undefined

  useEffect(() => {
    if (!tool) {
      addNotification({ type: 'error', message: 'Tool not found.' })
      navigate('/tools', { replace: true })
    }
  }, [tool, navigate, addNotification])

  if (!tool) return null

  return (
    <Layout title={tool.name}>
      <ToolRunner tool={tool} onBack={() => navigate('/tools')} />
    </Layout>
  )
}

// Re-exported so routes can pull everything from this module.
export const totalToolCount = toolDefinitions.length