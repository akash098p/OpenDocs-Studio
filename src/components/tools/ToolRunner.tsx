import React, { useState } from 'react'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/Card'
import { useUIStore } from '@store/uiStore'
import { ToolDefinition, ToolField, ToolFile, ToolParams } from '@/tools/types'
import { runTool } from '@/tools'
import { downloadBlob, makeZip } from '@/tools/helpers'

interface ToolRunnerProps {
  tool: ToolDefinition
  onBack: () => void
}

const ToolFieldInput: React.FC<{ field: ToolField; value: string; onChange: (value: string) => void }> = ({ field, value, onChange }) => {
  const sharedClass =
    'flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary-500'
  if (field.type === 'select') {
    return (
      <select name={field.name} value={value} onChange={(event) => onChange(event.target.value)} className={sharedClass}>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }
  if (field.type === 'number') {
    return (
      <input
        name={field.name}
        type="number"
        value={value}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(event) => onChange(event.target.value)}
        className={sharedClass}
      />
    )
  }
  return (
    <input name={field.name} type="text" value={value} onChange={(event) => onChange(event.target.value)} className={sharedClass} />
  )
}

export const ToolRunner: React.FC<ToolRunnerProps> = ({ tool, onBack }) => {
  const { addNotification } = useUIStore()
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(tool.fields.map((field) => [field.name, String(field.default ?? '')])),
  )
  const [fileMap, setFileMap] = useState<Record<string, FileList | null>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const setParam = (name: string, value: string) => setFieldValues((prev) => ({ ...prev, [name]: value }))

  const handleRun = async () => {
    const files: ToolFile[] = []
    for (const input of tool.inputs) {
      const list = fileMap[input.name]
      if (!list || list.length === 0) continue
      for (let i = 0; i < list.length; i += 1) {
        files.push({ name: input.name, blob: list[i] })
      }
    }

    for (const input of tool.inputs) {
      if (input.optional) continue
      if (!files.some((file) => file.name === input.name)) {
        addNotification({ type: 'error', message: `Please choose ${input.label.toLowerCase()}.` })
        return
      }
    }

    const params: ToolParams = fieldValues
    setIsRunning(true)
    setStatus('Starting...')
    setProgress(5)

    try {
      const outputs = await runTool(
        tool.id,
        files,
        params,
        (percent, message) => {
          setProgress(percent)
          setStatus(message)
        },
      )
      if (!outputs.length) throw new Error('Tool produced no output.')

      if (outputs.length === 1) {
        downloadBlob(outputs[0].blob, outputs[0].name)
      } else {
        const zip = await makeZip(outputs)
        downloadBlob(zip, `${tool.id}-output.zip`)
      }
      setStatus('Done — ready to download.')
      setProgress(100)
      addNotification({ type: 'success', message: 'Tool completed successfully.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run the tool.'
      setStatus(`Error: ${message}`)
      setProgress(0)
      addNotification({ type: 'error', message })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={tool.icon} alt="" className="h-12 w-12 rounded-lg" />
            <div>
              <CardTitle>{tool.name}</CardTitle>
              <CardDescription className="mt-1 max-w-xl">{tool.description}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} type="button">
            ← All tools
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            {tool.inputs.map((input) => (
              <div key={input.name}>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{input.label}</label>
                <input
                  type="file"
                  name={input.name}
                  accept={input.accept}
                  multiple={input.multiple}
                  onChange={(event) => setFileMap((prev) => ({ ...prev, [input.name]: event.target.files }))}
                  className="block w-full rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                />
              </div>
            ))}

            {tool.fields.map((field) => (
              <div key={field.name}>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</label>
                <ToolFieldInput field={field} value={fieldValues[field.name] ?? ''} onChange={(value) => setParam(field.name, value)} />
              </div>
            ))}

            <Button type="button" onClick={handleRun} isLoading={isRunning} disabled={isRunning} className="w-full">
              {isRunning ? 'Working...' : 'Run Tool'}
            </Button>
          </div>

          <div>
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold">Output appears here</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Your files are processed entirely in this browser — nothing is uploaded anywhere.
              </p>
            </div>

            {progress > 0 && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className={`mt-2 text-sm ${status.startsWith('Error') ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
                  {status}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}