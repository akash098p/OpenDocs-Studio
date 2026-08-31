import { ToolFile, ToolOutput, ToolParams } from './types'
import { getFile, fileName, sanitizeFilename, stringParam } from './helpers'
import { Progress } from './imageProcessors'

const loadText = async (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Text Case Converter
// ---------------------------------------------------------------------------
export const textCaseConvert = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'text')
  const mode = stringParam(params, 'mode', 'uppercase')

  onProgress?.(10, 'Reading text...')
  const text = await loadText(file.blob)
  onProgress?.(30, 'Converting case...')

  let result: string
  switch (mode) {
    case 'uppercase':
      result = text.toUpperCase()
      break
    case 'lowercase':
      result = text.toLowerCase()
      break
    case 'titlecase':
      result = text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      break
    case 'capitalizewords':
      result = text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      break
    case 'invertcase':
      result = text
        .split('')
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join('')
      break
    default:
      result = text
  }

  onProgress?.(100, 'Done.')
  const base = sanitizeFilename(fileName(file.name)) || 'converted'
  return [{ name: `${base}-${mode}.txt`, blob: new Blob([result], { type: 'text/plain' }) }]
}

// ---------------------------------------------------------------------------
// Find and Replace in Text
// ---------------------------------------------------------------------------
export const textFindReplace = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'text')
  const find = stringParam(params, 'find', '')
  const replace = stringParam(params, 'replace', '')
  const caseSensitive = stringParam(params, 'caseSensitive', 'false') === 'true'
  const wholeWord = stringParam(params, 'wholeWord', 'false') === 'true'

  if (!find) throw new Error('Enter a search term to find.')

  onProgress?.(10, 'Reading text...')
  const text = await loadText(file.blob)
  onProgress?.(30, 'Searching and replacing...')

  const flags = caseSensitive ? 'g' : 'gi'
  const matchCount = (text.match(new RegExp(escapeRegex(find), flags)) || []).length

  let result: string
  if (wholeWord) {
    result = text.replace(new RegExp(`\\b${escapeRegex(find)}\\b`, flags), replace)
  } else {
    result = text.replace(new RegExp(escapeRegex(find), flags), replace)
  }

  onProgress?.(100, 'Done.')
  const base = sanitizeFilename(fileName(file.name)) || 'replaced'
  const output = `--- Find & Replace Report ---\nSearch: "${find}"\nReplace: "${replace}"\nMatches found: ${matchCount}\nCase sensitive: ${caseSensitive ? 'Yes' : 'No'}\nWhole word: ${wholeWord ? 'Yes' : 'No'}\n\n--- Result ---\n${result}`
    return [{ name: `${base}-replaced.txt`, blob: new Blob([output], { type: 'text/plain' }) }]
}

// ---------------------------------------------------------------------------
// Word Counter
// ---------------------------------------------------------------------------
export const textWordCount = async (files: ToolFile[], _params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'text')

  onProgress?.(20, 'Analyzing...')
  const text = await loadText(file.blob)

  const words = text.split(/\s+/).filter(Boolean)
  const lines = text.split('\n')
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean)
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length

  const report = `# Word Count Report\n\n` +
    `File: ${file.name}\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `## Statistics\n\n` +
    `| Metric | Count |\n` +
    `|--------|------|\n` +
    `| Words | ${words.length} |\n` +
    `| Characters (with spaces) | ${characters} |\n` +
    `| Characters (no spaces) | ${charactersNoSpaces} |\n` +
    `| Lines | ${lines.length} |\n` +
    `| Paragraphs | ${paragraphs.length} |\n`

  onProgress?.(100, 'Done.')
  const base = sanitizeFilename(fileName(file.name)) || 'text'
  return [{ name: `${base}-wordcount.txt`, blob: new Blob([report], { type: 'text/plain' }) }]
}

// ---------------------------------------------------------------------------
// Text Encoding Converter
// ---------------------------------------------------------------------------
export const textEncodingConvert = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'text')
  const fromEncoding = stringParam(params, 'fromEncoding', 'auto')
  const toEncoding = stringParam(params, 'toEncoding', 'utf8')

  onProgress?.(20, 'Reading file...')
  const arrayBuffer = await file.blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  let text: string
  if (fromEncoding === 'auto') {
    try {
      text = new TextDecoder('utf-8').decode(bytes)
    } catch {
      text = new TextDecoder('latin1').decode(bytes)
    }
  } else if (fromEncoding === 'latin1') {
    text = new TextDecoder('latin1').decode(bytes)
  } else {
    text = new TextDecoder('utf-8').decode(bytes)
  }

  onProgress?.(60, `Converting to ${toEncoding}...`)
  let output: Blob
  if (toEncoding === 'utf8') {
    output = new Blob([text], { type: 'text/plain;charset=utf-8' })
  } else if (toEncoding === 'ascii') {
    output = new Blob([text.replace(/[^\x00-\x7F]/g, '?')], { type: 'text/plain;charset=ascii' })
  } else if (toEncoding === 'base64') {
    const b64 = btoa(text)
    output = new Blob([b64], { type: 'text/plain' })
  } else if (toEncoding === 'hex') {
    const hex = Array.from(new TextEncoder().encode(text))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    output = new Blob([hex], { type: 'text/plain' })
  } else {
    output = new Blob([text], { type: 'text/plain' })
  }

  onProgress?.(100, 'Done.')
  const base = sanitizeFilename(fileName(file.name)) || 'converted'
  const ext = toEncoding === 'base64' ? 'b64' : toEncoding === 'hex' ? 'hex' : 'txt'
  return [{ name: `${base}-${toEncoding}.${ext}`, blob: output }]
}

// ---------------------------------------------------------------------------
// Sort Lines
// ---------------------------------------------------------------------------
export const textSortLines = async (files: ToolFile[], params: ToolParams, onProgress?: Progress): Promise<ToolOutput[]> => {
  const file = getFile(files, 'text')
  const order = stringParam(params, 'order', 'ascending')
  const removeDuplicates = stringParam(params, 'deduplicate', 'false') === 'true'
  const caseSensitive = stringParam(params, 'caseSensitive', 'false') === 'true'

  onProgress?.(20, 'Reading lines...')
  const text = await loadText(file.blob)
  let lines = text.split('\n')

  onProgress?.(50, 'Sorting...')
  if (order === 'descending') {
    lines.sort((a, b) => {
      if (caseSensitive) return b.localeCompare(a)
      return b.toLowerCase().localeCompare(a.toLowerCase())
    })
  } else {
    lines.sort((a, b) => {
      if (caseSensitive) return a.localeCompare(b)
      return a.toLowerCase().localeCompare(b.toLowerCase())
    })
  }

  if (removeDuplicates) {
    lines = [...new Set(lines)]
  }

  onProgress?.(100, 'Done.')
  const base = sanitizeFilename(fileName(file.name)) || 'sorted'
  return [{ name: `${base}-sorted.txt`, blob: new Blob([lines.join('\n')], { type: 'text/plain' }) }]
}

