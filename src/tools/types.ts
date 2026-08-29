export type ToolFieldType = 'number' | 'select' | 'text' | 'color'

export interface ToolField {
  name: string
  label: string
  type: ToolFieldType
  default?: string | number
  min?: number
  max?: number
  step?: number
  options?: string[]
  required?: boolean
}

export interface ToolInput {
  name: string
  label: string
  accept: string
  multiple?: boolean
  optional?: boolean
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
  editor?: 'crop-rotate' | 'resize'
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