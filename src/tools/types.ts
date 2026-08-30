export type ToolFieldType = 'number' | 'select' | 'text' | 'color' | 'font' | 'password' | 'range'

export interface ToolField {
  name: string
  label: string
  type: ToolFieldType
  default?: string | number
  min?: number
  max?: number
  step?: number
  options?: string[]
  /** When set, this field is only visible if the named field value equals the given value. */
  visibleWhen?: { field: string; equals: string }
  /** Render this field above the file inputs — used for mode switches that gate which inputs are shown. */
  position?: 'top'
}

export interface ToolInput {
  name: string
  label: string
  accept: string
  multiple?: boolean
  optional?: boolean
  /** When set, this input is only shown if the named field value equals the given value. */
  visibleWhen?: { field: string; equals: string }
}

export interface ToolDefinition {
  id: string
  name: string
  group: 'Image' | 'PDF'
  icon: string
  description: string
  inputs: ToolInput[]
  fields: ToolField[]
  visualEditor?: boolean
  editor?: 'crop-rotate' | 'resize' | 'album'
  /** Show a live preview panel that re-renders the first input as fields change. */
  livePreview?: boolean
}

export interface VisualEditorHandle {
  getParams: () => Record<string, string>
}

export interface ToolFile {
  name: string
  blob: Blob
}

export type ToolParams = Record<string, string>

export interface ToolOutput {
  name: string
  blob: Blob
}

export type ToolRunner = (
  files: ToolFile[],
  params: ToolParams,
  onProgress?: (percent: number, message: string) => void,
) => Promise<ToolOutput[]>
