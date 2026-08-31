import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@utils/helpers'
import { formatFileSize } from '@utils/helpers'

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  label: string
  onFilesChange: (files: File[]) => void
  value?: File[]
}

const matchesAccept = (file: File, accept: string | undefined): boolean => {
  if (!accept) return true
  const patterns = accept.split(',').map((p) => p.trim())
  return patterns.some((pattern) => {
    if (pattern === '*/*') return true
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2)
      return file.type.startsWith(prefix + '/')
    }
    if (pattern.startsWith('.')) {
      return file.name.toLowerCase().endsWith(pattern.toLowerCase())
    }
    return file.type === pattern
  })
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept, multiple = false, label, onFilesChange, value = [],
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef<Map<string, string>>(new Map())

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }
  const mergeFiles = (incoming: File[]) => {
    if (!multiple) {
      onFilesChange([incoming[0]])
      return
    }
    // Multi-file inputs append to the list (deduped) so batches can be built up across drops.
    const seen = new Set(value.map((f) => `${f.name}:${f.size}`))
    const merged = [...value]
    for (const file of incoming) {
      const key = `${file.name}:${file.size}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(file)
      }
    }
    onFilesChange(merged)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    const filtered = dropped.filter((f) => matchesAccept(f, accept))
    if (filtered.length) mergeFiles(filtered)
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) => matchesAccept(f, accept))
      if (selected.length) mergeFiles(selected)
      e.target.value = ''
    }
  }
  const handleRemoveFile = (index: number) => {
    const newFiles = [...value]
    const removed = newFiles.splice(index, 1)[0]
    const url = previewUrls.current.get(removed.name)
    if (url) { URL.revokeObjectURL(url); previewUrls.current.delete(removed.name) }
    onFilesChange(newFiles)
  }
  const isImage = (file: File) => file.type.startsWith('image/')
  const getPreviewUrl = (file: File): string | null => {
    if (!isImage(file)) return null
    const existing = previewUrls.current.get(file.name)
    if (existing) return existing
    const url = URL.createObjectURL(file)
    previewUrls.current.set(file.name, url)
    return url
  }
  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current.clear()
  }, [])

  const selectedCount = value.length

  return (
    <div className="space-y-3">
      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div
        className={cn(
          'relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-all duration-200',
          isDragging
            ? 'border-orange-500 bg-orange-50 dark:border-primary-500 dark:bg-primary-900/20'
            : 'border-slate-300 bg-slate-50 hover:border-orange-400 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept={accept} multiple={multiple} onChange={handleFileSelect} className="hidden" />
        <svg className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V8a4 4 0 014-4h2a4 4 0 014 4v8m-6 4h6a2 2 0 002-2v1a2 2 0 01-2 2h-6a2 2 0 01-2-2v-1a2 2 0 012-2h6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9h.01M9.5 13h.01M12 9h.01M12 13h.01" />
        </svg>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isDragging ? 'Drop files here to upload' : 'Drop files here or click to browse'}
        </p>
        {accept && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Accepting: {accept}</p>}
      </div>

      {selectedCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {selectedCount} file{selectedCount !== 1 ? 's' : ''} selected
            </p>
            <button
              type="button"
              onClick={() => {
                previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
                previewUrls.current.clear()
                onFilesChange([])
              }}
              className="text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Remove all
            </button>
          </div>
          {value.map((file, index) => {
            const previewUrl = isImage(file) ? getPreviewUrl(file) : null
            return (
              <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                {previewUrl ? (
                  <img src={previewUrl} alt={file.name} className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-200 dark:bg-slate-700">
                    <svg className="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5.291A10.014 10.014 0 0112 22l-10-3v-7l10-5 10 5v7l-10 3a10.014 10.014 0 01-7-2.709" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => handleRemoveFile(index)} className="text-red-500 hover:text-red-700" title="Remove file">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
