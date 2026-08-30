import React, { useRef, useState } from 'react'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/Card'
import { FileUpload } from '@components/ui/FileUpload'
import { OutputPreview } from '@components/tools/OutputPreview'
import { ImageEditor } from './ImageEditor'
import { ResizeEditor } from './ResizeEditor'
import { AlbumEditor } from './AlbumEditor'
import { FONT_STACKS } from '@/tools/helpers'
import { useUIStore } from '@store/uiStore'
import { ToolDefinition, ToolField, ToolFile, ToolOutput, ToolParams, VisualEditorHandle } from '@/tools/types'
import { runTool } from '@/tools'

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
  if (field.type === 'font') {
    return (
      <select
        name={field.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={sharedClass}
        style={{ fontFamily: FONT_STACKS[value] ?? FONT_STACKS.Arial }}
      >
        {(field.options || []).map((option) => (
          <option key={option} value={option} style={{ fontFamily: FONT_STACKS[option] ?? 'inherit' }}>
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
  if (field.type === 'color') {
    const isValidHex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value)
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          name={field.name}
          value={isValidHex ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800"
          aria-label={`${field.label} picker`}
        />
        <input
          name={field.name}
          type="text"
          value={value}
          onChange={(event) => {
            const trimmed = event.target.value.trim().replace(/^#*/i, '')
            onChange(trimmed ? `#${trimmed.toUpperCase()}` : '')
          }}
          placeholder="#RRGGBB"
          className={sharedClass}
        />
      </div>
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
  const [fileMap, setFileMap] = useState<Record<string, File[]>>({})
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [outputs, setOutputs] = useState<ToolOutput[] | null>(null)
  const editorRef = useRef<VisualEditorHandle>(null)

  const editorInput = tool.visualEditor ? tool.inputs[0] : undefined
  const editorFiles = editorInput ? fileMap[editorInput.name] || [] : []

  const setParam = (name: string, value: string) => setFieldValues((prev) => ({ ...prev, [name]: value }))

  const handleRun = async () => {
    const files: ToolFile[] = []
    for (const input of tool.inputs) {
      const list = fileMap[input.name] || []
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

    const editorParams = tool.visualEditor ? editorRef.current?.getParams() : undefined
    const params: ToolParams = { ...fieldValues, ...(editorParams || {}) }
    setIsRunning(true)
    setStatus('Starting...')
    setProgress(5)
    setOutputs(null)

    try {
      const result = await runTool(
        tool.id,
        files,
        params,
        (percent, message) => {
          setProgress(percent)
          setStatus(message)
        },
      )
      if (!result.length) throw new Error('Tool produced no output.')

      setOutputs(result)
      setStatus('Done — preview ready.')
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

  const handleClear = () => {
    setOutputs(null)
    setStatus('')
    setProgress(0)
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
              <FileUpload
                key={input.name}
                label={input.label}
                accept={input.accept}
                multiple={input.multiple}
                onFilesChange={(files) => setFileMap((prev) => ({ ...prev, [input.name]: files }))}
                value={fileMap[input.name] || []}
              />
            ))}

            {tool.visualEditor && (
              <div>
                {editorFiles.length > 0 ? (
                  tool.editor === 'album' ? (
                    <AlbumEditor ref={editorRef} files={editorFiles} />
                  ) : tool.editor === 'resize' ? (
                    <ResizeEditor ref={editorRef} file={editorFiles[0]} />
                  ) : (
                    <ImageEditor ref={editorRef} file={editorFiles[0]} />
                  )
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    {tool.editor === 'album'
                      ? 'Add photos above to open the album designer.'
                      : tool.editor === 'resize'
                        ? 'Add an image above to open the resize editor.'
                        : 'Add an image above to open the crop & rotate editor.'}
                  </p>
                )}
              </div>
            )}

            {tool.fields.filter((field) => {
              if (!field.visibleWhen) return true
              return fieldValues[field.visibleWhen.field] === field.visibleWhen.equals
            }).map((field) => (
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
            {outputs ? (
              <OutputPreview outputs={outputs} onClear={handleClear} />
            ) : (
              <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold">Output appears here</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Your files are processed entirely in this browser — nothing is uploaded anywhere.
                </p>
              </div>
            )}

            {isRunning && (
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
